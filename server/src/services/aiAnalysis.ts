/*
 * This file is part of Demonitize.
 * Copyright (C) 2026 Mark Sherman
 *
 * Demonitize is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * Demonitize is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import OpenAI from 'openai';
import { AiAnalysis, Platform } from '../types';

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured. Set it in .env to enable AI analysis.');
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

function platformLabel(platform: Platform): string {
  switch (platform) {
    case 'android': return 'Android (smali/DEX)';
    case 'ios': return 'iOS (binary/Objective-C)';
    case 'android-bundle': return 'Android App Bundle (AAB/APK bundle)';
    case 'browser': return 'Browser extension (Chrome/Firefox)';
    case 'windows': return 'Windows Store App (MSIX/APPX)';
    case 'linux': return 'Linux AppImage/Snap/Flatpak';
  }
}

export async function analyzeAdCode(
  sdkName: string,
  codeContext: string,
  manifestContext: string,
  platform: Platform
): Promise<AiAnalysis> {
  const prompt = `You are an expert reverse engineer and ad-tech specialist analyzing ad integration in a ${platformLabel(platform)} application.

You are analyzing the ad SDK: **${sdkName}**

Here is the relevant code context found:
\`\`\`
${codeContext.slice(0, 6000)}
\`\`\`

${manifestContext ? `Manifest/config context:\n\`\`\`\n${manifestContext.slice(0, 4000)}\n\`\`\`` : ''}

Please analyze this ad integration and provide a detailed response in the following JSON format:

{
  "howItWorks": "Detailed explanation of how this ad SDK is integrated and how it serves ads",
  "initializationFlow": "How the SDK is initialized - the entry point and call chain",
  "displayEntryPoints": ["Entry point 1 for ad display", "Entry point 2"],
  "minimalPatch": "The minimal code change needed to disable ONLY this ad SDK without breaking other app functionality. Be specific about what to comment out, return early from, or null-check.",
  "antiTamperConcerns": "Any anti-tampering, integrity checks, or crash risks from disabling this SDK",
  "confidence": "high|medium|low"
}

IMPORTANT RULES:
1. Focus ONLY on disabling ad functionality, NOT analytics, crash reporting, or legitimate networking
2. Prefer early-return patterns over deleting code
3. If the SDK has a consent/initialization call, suggest returning early from it
4. For ad view/banner injection, suggest replacing with an empty/zero-size element
5. Do NOT suggest stripping ALL network calls - only ad-related ones
6. Consider that some "ad" SDKs also handle mediation and analytics - only disable the ad-display parts
7. Be surgical and precise - we want to disable ads while keeping the app functional`;

  try {
    const client = getOpenAI();
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert reverse engineer specializing in ad-tech analysis. You output only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || '{}';
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        sdkName,
        howItWorks: parsed.howItWorks || 'Analysis not available',
        initializationFlow: parsed.initializationFlow || 'Unknown',
        displayEntryPoints: parsed.displayEntryPoints || [],
        minimalPatch: parsed.minimalPatch || 'No patch recommendation available',
        antiTamperConcerns: parsed.antiTamperConcerns || 'None identified',
        confidence: parsed.confidence || 'medium',
      };
    }
    throw new Error('Could not parse AI response as JSON');
  } catch (error: any) {
    // Fallback analysis when AI is unavailable (missing API key, network error, etc.)
    console.warn(`AI analysis fallback for ${sdkName}: ${error.message || 'unknown error'}`);
    return {
      sdkName,
      howItWorks: `The ${sdkName} SDK is integrated into the app to display advertisements. It initializes on app startup and loads/displays ads through its standard API.`,
      initializationFlow: `Standard ${sdkName} initialization flow detected.`,
      displayEntryPoints: [
        'Banner ad creation',
        'Interstitial ad loading and display',
        'Rewarded video ad presentation',
      ],
      minimalPatch: `Locate the ${sdkName} initialization call and insert an early return before it executes. For ad display methods, replace with no-op equivalents. Remove ${sdkName} configuration entries from the manifest.`,
      antiTamperConcerns: `Standard risk: some apps check if ad SDK classes/modules are present. Ensure ad module stubs remain to prevent runtime errors.`,
      confidence: 'low',
    };
  }
}
