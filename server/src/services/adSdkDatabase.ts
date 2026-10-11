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

// Known advertising SDK patterns for detection
export interface AdSdkSignature {
  name: string;
  packagePatterns: string[];
  classPatterns: string[];
  methodPatterns: string[];
  manifestPatterns: string[];
  urlPatterns: string[];
}

export const KNOWN_AD_SDKS: AdSdkSignature[] = [
  {
    name: 'Google AdMob',
    packagePatterns: ['com.google.android.gms.ads', 'com.google.ads'],
    classPatterns: [
      'com/google/android/gms/ads/AdView',
      'com/google/android/gms/ads/InterstitialAd',
      'com/google/android/gms/ads/MobileAds',
      'com/google/android/gms/ads/AdRequest',
      'com/google/android/gms/ads/rewarded',
      'com/google/android/gms/ads/initialization',
    ],
    methodPatterns: [
      'MobileAds/initialize',
      'AdRequest/Builder',
      'loadAd',
      'AdView',
      'InterstitialAd/load',
      'RewardedAd/load',
    ],
    manifestPatterns: [
      'com.google.android.gms.ads.AdActivity',
      'com.google.android.gms.ads.APPLICATION_ID',
    ],
    urlPatterns: ['doubleclick.net', 'googlesyndication.com', 'googleadservices.com'],
  },
  {
    name: 'Facebook Audience Network',
    packagePatterns: ['com.facebook.ads'],
    classPatterns: [
      'com/facebook/ads/AdView',
      'com/facebook/ads/InterstitialAd',
      'com/facebook/ads/AudienceNetworkAds',
      'com/facebook/ads/RewardedVideoAd',
    ],
    methodPatterns: [
      'AudienceNetworkAds/initialize',
      'AdView',
      'InterstitialAd',
      'RewardedVideoAd',
      'loadAd',
    ],
    manifestPatterns: [
      'com.facebook.ads.AudienceNetworkActivity',
      'com.facebook.ads.APPLICATION_ID',
    ],
    urlPatterns: ['fbad.com', 'facebook.com/ad', 'fbcdn.net'],
  },
  {
    name: 'Unity Ads',
    packagePatterns: ['com.unity3d.ads', 'com.unity3d.services'],
    classPatterns: [
      'com/unity3d/ads/IUnityAdsListener',
      'com/unity3d/ads/UnityAds',
      'com/unity3d/services',
    ],
    methodPatterns: [
      'UnityAds/initialize',
      'UnityAds/show',
      'UnityAds/load',
      'IUnityAdsListener',
    ],
    manifestPatterns: ['com.unity3d.ads.adunit'],
    urlPatterns: ['unityads.unity3d.com', 'unity3d.com'],
  },
  {
    name: 'AppLovin',
    packagePatterns: ['com.applovin'],
    classPatterns: [
      'com/applovin/sdk/AppLovinSdk',
      'com/applovin/adview',
      'com/applovin/mediation',
    ],
    methodPatterns: [
      'AppLovinSdk/initialize',
      'AppLovinAdView',
      'AppLovinInterstitial',
      'AppLovinRewarded',
    ],
    manifestPatterns: [
      'com.applovin.adview.AppLovinInterstitialActivity',
      'com.applovin.sdk.APPLICATION_ID',
    ],
    urlPatterns: ['applovin.com', 'applvn.com'],
  },
  {
    name: 'IronSource',
    packagePatterns: ['com.ironsource'],
    classPatterns: [
      'com/ironsource/sdk',
      'com/ironsource/mediationsdk',
      'com/ironsource/environment',
    ],
    methodPatterns: [
      'IronSource/init',
      'IronSource/loadInterstitial',
      'IronSource/showRewardedVideo',
      'IronSource/setConsent',
    ],
    manifestPatterns: ['com.ironsource.sdk.controller.InterstitialActivity'],
    urlPatterns: ['ironsrc.com', 'ironsource.com'],
  },
  {
    name: 'Vungle',
    packagePatterns: ['com.vungle'],
    classPatterns: [
      'com/vungle/warren',
      'com/vungle/ads',
      'com/vungle/sdk',
    ],
    methodPatterns: [
      'Vungle/init',
      'Vungle/loadAd',
      'Vungle/playAd',
    ],
    manifestPatterns: ['com.vungle.warren.ui.VungleActivity'],
    urlPatterns: ['vungle.com', 'vungleads.com'],
  },
  {
    name: 'AdColony',
    packagePatterns: ['com.adcolony'],
    classPatterns: [
      'com/adcolony/sdk/AdColony',
      'com/adcolony/sdk/AdColonyInterstitial',
      'com/adcolony/sdk/AdColonyReward',
    ],
    methodPatterns: [
      'AdColony/configure',
      'AdColony/requestInterstitial',
      'AdColony/show',
    ],
    manifestPatterns: ['com.adcolony.sdk.AdColonyInterstitialActivity'],
    urlPatterns: ['adcolony.com'],
  },
  {
    name: 'Chartboost',
    packagePatterns: ['com.chartboost'],
    classPatterns: [
      'com/chartboost/sdk/Chartboost',
      'com/chartboost/sdk/ads',
    ],
    methodPatterns: [
      'Chartboost/startWithAppId',
      'Chartboost/showInterstitial',
      'Chartboost/showRewardedVideo',
    ],
    manifestPatterns: ['com.chartboost.sdk.ChartboostActivity'],
    urlPatterns: ['chartboost.com'],
  },
  {
    name: 'InMobi',
    packagePatterns: ['com.inmobi'],
    classPatterns: [
      'com/inmobi/ads/InMobiAdRequest',
      'com/inmobi/sdk/InMobiSdk',
      'com/inmobi/ads/InMobiBanner',
      'com/inmobi/ads/InMobiInterstitial',
    ],
    methodPatterns: [
      'InMobiSdk/init',
      'InMobiBanner/load',
      'InMobiInterstitial/show',
    ],
    manifestPatterns: ['com.inmobi.ads.rendering.InMobiAdActivity'],
    urlPatterns: ['inmobi.com', 'inmobi.net'],
  },
  {
    name: 'AdMob Mediation / MoPub',
    packagePatterns: ['com.mopub'],
    classPatterns: [
      'com/mopub/mobileads/MoPubView',
      'com/mopub/mobileads/MoPubInterstitial',
      'com/mopub/common/MoPub',
    ],
    methodPatterns: [
      'MoPub/initializeSdk',
      'MoPubView/loadAd',
      'MoPubInterstitial/load',
      'MoPubRewardedVideo',
    ],
    manifestPatterns: ['com.mopub.mobileads.MoPubActivity'],
    urlPatterns: ['mopub.com', 'mopub.com'],
  },
  {
    name: 'StartApp',
    packagePatterns: ['com.startapp'],
    classPatterns: [
      'com/startapp/sdk/adsbase/StartAppSDK',
      'com/startapp/sdk/ads/banner',
      'com/startapp/sdk/ads/interstitials',
    ],
    methodPatterns: [
      'StartAppSDK/init',
      'StartAppAd',
      'showAd',
    ],
    manifestPatterns: ['com.startapp.sdk.adsbase.consent.ConsentActivity'],
    urlPatterns: ['startapp.com', 'startappexchange.com'],
  },
  {
    name: 'Tapjoy',
    packagePatterns: ['com.tapjoy'],
    classPatterns: [
      'com/tapjoy/TapjoyConnect',
      'com/tapjoy/TJPlacement',
      'com/tapjoy/Tapjoy',
    ],
    methodPatterns: [
      'Tapjoy/connect',
      'Tapjoy/requestContent',
      'Tapjoy/showContent',
    ],
    manifestPatterns: ['com.tapjoy.TJAdUnitActivity'],
    urlPatterns: ['tapjoy.com', 'tapjoyads.com'],
  },
  {
    name: 'Mintegral',
    packagePatterns: ['com.mintegral.msdk'],
    classPatterns: [
      'com/mintegral/msdk',
    ],
    methodPatterns: [
      'Mintegral/init',
      'Mintegral/load',
    ],
    manifestPatterns: ['com.mintegral.msdk.activity'],
    urlPatterns: ['mintegral.com'],
  },
  {
    name: 'Fyber / Digital Turbine',
    packagePatterns: ['com.fyber', 'com.digitalturbine'],
    classPatterns: [
      'com/fyber/ads',
      'com/fyber/FairBid',
    ],
    methodPatterns: [
      'FairBid/start',
      'FyberAd',
      'InterstitialAd',
    ],
    manifestPatterns: ['com.fyber.ads.interstitials'],
    urlPatterns: ['fyber.com', 'digitalturbine.com'],
  },
  {
    name: 'Smaato',
    packagePatterns: ['com.smaato'],
    classPatterns: [
      'com/smaato/sdk',
    ],
    methodPatterns: [
      'SmaatoSdk/init',
      'BannerView',
      'Interstitial',
    ],
    manifestPatterns: ['com.smaato.sdk.SmaatoActivity'],
    urlPatterns: ['smaato.net', 'smaato.com'],
  },
  {
    name: 'Ogury',
    packagePatterns: ['com.ogury'],
    classPatterns: [
      'com/ogury/ed',
      'com/ogury/core',
    ],
    methodPatterns: [
      'Ogury/start',
      'Ogury/presage',
    ],
    manifestPatterns: ['com.ogury.ed.OguryAdActivity'],
    urlPatterns: ['ogury.com'],
  },
  {
    name: 'HyprMX',
    packagePatterns: ['com.hyprmx'],
    classPatterns: [
      'com/hyprmx/android/sdk',
    ],
    methodPatterns: [
      'HyprMX/init',
      'HyprMX/show',
    ],
    manifestPatterns: ['com.hyprmx.android.sdk.HyprMXActivity'],
    urlPatterns: ['hyprmx.com'],
  },
  {
    name: 'Bigo Ads',
    packagePatterns: ['com.bigo.ads', 'com.bigossp'],
    classPatterns: [
      'com/bigo/ads',
    ],
    methodPatterns: [
      'BigoAd',
      'BigoAds/init',
    ],
    manifestPatterns: [],
    urlPatterns: ['bigo.sg', 'bigo.tv'],
  },
  {
    name: 'MyTarget (VK/Mail.ru)',
    packagePatterns: ['com.my.target'],
    classPatterns: [
      'com/my/target/ads',
      'com/my/target/common',
    ],
    methodPatterns: [
      'MyTargetView',
      'MyTargetAds/init',
    ],
    manifestPatterns: ['com.my.target.common.MyTargetActivity'],
    urlPatterns: ['my.com'],
  },
  {
    name: 'Pangle (ByteDance/TikTok)',
    packagePatterns: ['com.bytedance.sdk', 'com.pangle'],
    classPatterns: [
      'com/bytedance/sdk/openadsdk',
      'com/pangle/ads',
    ],
    methodPatterns: [
      'TTAdSdk/init',
      'TTAdManager',
      'Pangle/init',
    ],
    manifestPatterns: ['com.bytedance.sdk.openadsdk.activity'],
    urlPatterns: ['pangle.io', 'bytedance.com'],
  },
  {
    name: 'Yandex Ads',
    packagePatterns: ['com.yandex.mobile.ads'],
    classPatterns: [
      'com/yandex/mobile/ads',
      'com/yandex/adlib',
    ],
    methodPatterns: [
      'YandexMobileAds',
      'InterstitialAd',
      'BannerAdView',
    ],
    manifestPatterns: ['com.yandex.mobile.ads.AdActivity'],
    urlPatterns: ['yandex.ru', 'yandex.com'],
  },
  {
    name: 'Amazon Ads',
    packagePatterns: ['com.amazon.device.ads'],
    classPatterns: [
      'com/amazon/device/ads',
    ],
    methodPatterns: [
      'AmazonAd',
      'AdRegistration',
    ],
    manifestPatterns: ['com.amazon.device.ads.AdActivity'],
    urlPatterns: ['amazon-adsystem.com'],
  },
  {
    name: 'Baidu Ads',
    packagePatterns: ['com.baidu.mobads'],
    classPatterns: [
      'com/baidu/mobads',
    ],
    methodPatterns: [
      'BaiduAd',
      'BaiduMobads/init',
    ],
    manifestPatterns: ['com.baidu.mobads.AppActivity'],
    urlPatterns: ['baidu.com', 'mobads.baidu.com'],
  },
  {
    name: 'Tencent Ads (GDT)',
    packagePatterns: ['com.qq.e.ads', 'com.qq.e.comm'],
    classPatterns: [
      'com/qq/e/ads',
      'com/qq/e/comm',
    ],
    methodPatterns: [
      'GDTAd',
      'initGDT',
    ],
    manifestPatterns: ['com.qq.e.ads.AdActivity'],
    urlPatterns: ['gdt.qq.com', 'qzs.gdtimg.com'],
  },
  {
    name: 'Leadbolt',
    packagePatterns: ['com.leadbolt'],
    classPatterns: [
      'com/leadbolt/ad',
    ],
    methodPatterns: [
      'Leadbolt/init',
    ],
    manifestPatterns: [],
    urlPatterns: ['leadbolt.com', 'leadboltads.com'],
  },
  {
    name: 'RevMob',
    packagePatterns: ['com.revmob'],
    classPatterns: [
      'com/revmob/ads',
    ],
    methodPatterns: [
      'RevMob/start',
      'RevMob/show',
    ],
    manifestPatterns: [],
    urlPatterns: ['revmob.com'],
  },
  {
    name: 'Appnext',
    packagePatterns: ['com.appnext'],
    classPatterns: [
      'com/appnext/ads',
    ],
    methodPatterns: [
      'Appnext/init',
      'AppnextBannerView',
    ],
    manifestPatterns: [],
    urlPatterns: ['appnext.com'],
  },
  {
    name: 'AdGateMedia',
    packagePatterns: ['com.adgatemedia'],
    classPatterns: [
      'com/adgatemedia/sdk',
    ],
    methodPatterns: [
      'AdGateMedia/init',
    ],
    manifestPatterns: [],
    urlPatterns: ['adgatemedia.com'],
  },
  {
    name: 'SuperAwesome',
    packagePatterns: ['com.superawesome'],
    classPatterns: [
      'com/superawesome/sdk',
    ],
    methodPatterns: [
      'SuperAwesome/init',
    ],
    manifestPatterns: [],
    urlPatterns: ['superawesome.com'],
  },
  {
    name: 'Kidoz',
    packagePatterns: ['com.kidoz'],
    classPatterns: [
      'com/kidoz/sdk',
    ],
    methodPatterns: [
      'Kidoz/init',
    ],
    manifestPatterns: [],
    urlPatterns: ['kidoz.net'],
  },
  {
    name: 'LoopMe',
    packagePatterns: ['com.loopme'],
    classPatterns: [
      'com/loopme/ads',
    ],
    methodPatterns: [
      'LoopMe/init',
    ],
    manifestPatterns: ['com.loopme.ads.LoopMeAdActivity'],
    urlPatterns: ['loopme.com', 'loopme.me'],
  },
  {
    name: 'AerServ (InMobi)',
    packagePatterns: ['com.aerserv'],
    classPatterns: [
      'com/aerserv/sdk',
    ],
    methodPatterns: [
      'AerServ/init',
    ],
    manifestPatterns: [],
    urlPatterns: ['aerserv.com'],
  },
  {
    name: 'Flurry Ads (Yahoo)',
    packagePatterns: ['com.flurry.android.ads'],
    classPatterns: [
      'com/flurry/android/ads',
    ],
    methodPatterns: [
      'FlurryAds/init',
      'FlurryAdBanner',
    ],
    manifestPatterns: [],
    urlPatterns: ['flurry.com'],
  },
  {
    name: 'Verizon Media / ONE by AOL',
    packagePatterns: ['com.aol.mobile', 'com.verizon.ads'],
    classPatterns: [
      'com/aol/mobile/sdk',
      'com/verizon/ads',
    ],
    methodPatterns: [
      'VerizonAds/init',
      'AOL/init',
    ],
    manifestPatterns: [],
    urlPatterns: ['verizonmedia.com', 'aol.com'],
  },
  {
    name: 'Google Ad Manager',
    packagePatterns: ['com.google.android.gms.ads.admanager'],
    classPatterns: [
      'com/google/android/gms/ads/admanager/AdManagerAdView',
      'com/google/android/gms/ads/admanager/AdManagerInterstitialAd',
    ],
    methodPatterns: [
      'AdManagerAdRequest',
      'AdManagerAdView',
    ],
    manifestPatterns: ['com.google.android.gms.ads.admanager.AdManagerAdActivity'],
    urlPatterns: ['googlesyndication.com'],
  },
];

// iOS-specific ad SDK signatures
export const IOS_AD_SDKS: AdSdkSignature[] = [
  {
    name: 'Google Mobile Ads (iOS)',
    packagePatterns: ['GoogleMobileAds', 'GAD'],
    classPatterns: ['GADBannerView', 'GADInterstitial', 'GADRewardedAd', 'GADMobileAds'],
    methodPatterns: ['GADMobileAds/sharedInstance', 'startWithCompletionHandler', 'loadRequest'],
    manifestPatterns: ['GADApplicationIdentifier'],
    urlPatterns: ['doubleclick.net', 'googlesyndication.com'],
  },
  {
    name: 'Facebook Audience Network (iOS)',
    packagePatterns: ['FBAudienceNetwork', 'FBAd'],
    classPatterns: ['FBAdView', 'FBInterstitialAd', 'FBRewardedVideoAd', 'FBAdSettings'],
    methodPatterns: ['FBAdSettings', 'loadAd', 'FBAdView'],
    manifestPatterns: ['FacebookAdvertiserIDCollectionEnabled'],
    urlPatterns: ['fbad.com'],
  },
  {
    name: 'Unity Ads (iOS)',
    packagePatterns: ['UnityAds', 'UADSApi'],
    classPatterns: ['UnityAds', 'UADSPlayer'],
    methodPatterns: ['UnityAds/initialize', 'UnityAds/show', 'UnityAds/load'],
    manifestPatterns: [],
    urlPatterns: ['unityads.unity3d.com'],
  },
  {
    name: 'AppLovin (iOS)',
    packagePatterns: ['AppLovinSDK', 'AL'],
    classPatterns: ['ALAdView', 'ALInterstitialAd', 'ALIncentivizedInterstitialAd'],
    methodPatterns: ['ALSdk/initialize', 'ALAdView', 'showInterstitial'],
    manifestPatterns: ['AppLovinSdkKey'],
    urlPatterns: ['applovin.com'],
  },
  {
    name: 'IronSource (iOS)',
    packagePatterns: ['IronSource'],
    classPatterns: ['IronSource', 'ISRewardedVideo', 'ISInterstitial'],
    methodPatterns: ['IronSource/initWithAppKey', 'IronSource/showRewardedVideo'],
    manifestPatterns: [],
    urlPatterns: ['ironsrc.com'],
  },
];

export function detectAdSdksInSmali(smaliContent: string, filePath: string): { sdk: AdSdkSignature; matches: { type: string; match: string }[] }[] {
  const detected: { sdk: AdSdkSignature; matches: { type: string; match: string }[] }[] = [];

  for (const sdk of KNOWN_AD_SDKS) {
    const matches: { type: string; match: string }[] = [];

    for (const pkg of sdk.packagePatterns) {
      const smaliPkg = pkg.replace(/\./g, '/');
      if (smaliContent.includes(smaliPkg)) {
        matches.push({ type: 'package', match: pkg });
      }
    }

    for (const cls of sdk.classPatterns) {
      if (smaliContent.includes(cls)) {
        matches.push({ type: 'class', match: cls });
      }
    }

    for (const method of sdk.methodPatterns) {
      if (smaliContent.includes(method)) {
        matches.push({ type: 'method', match: method });
      }
    }

    if (matches.length > 0) {
      detected.push({ sdk, matches });
    }
  }

  return detected;
}

export function detectAdSdksInManifest(manifestContent: string): { sdk: AdSdkSignature; matches: string[] }[] {
  const detected: { sdk: AdSdkSignature; matches: string[] }[] = [];

  for (const sdk of KNOWN_AD_SDKS) {
    const matches: string[] = [];
    for (const pattern of sdk.manifestPatterns) {
      if (manifestContent.includes(pattern)) {
        matches.push(pattern);
      }
    }
    // Also check package references in manifest
    for (const pkg of sdk.packagePatterns) {
      if (manifestContent.includes(pkg)) {
        matches.push(`package-ref:${pkg}`);
      }
    }
    if (matches.length > 0) {
      detected.push({ sdk, matches });
    }
  }

  return detected;
}

export function detectAdSdksInBinary(hexContent: string): { sdk: AdSdkSignature; matches: string[] }[] {
  const detected: { sdk: AdSdkSignature; matches: string[] }[] = [];
  const allSdks = [...KNOWN_AD_SDKS, ...IOS_AD_SDKS];

  for (const sdk of allSdks) {
    const matches: string[] = [];
    for (const pkg of sdk.packagePatterns) {
      if (hexContent.includes(pkg)) {
        matches.push(pkg);
      }
    }
    for (const cls of sdk.classPatterns) {
      if (hexContent.includes(cls)) {
        matches.push(cls);
      }
    }
    if (matches.length > 0) {
      detected.push({ sdk, matches });
    }
  }

  return detected;
}

export function detectAdUrls(codeContent: string): string[] {
  const allSdks = [...KNOWN_AD_SDKS, ...IOS_AD_SDKS, ...BROWSER_AD_PATTERNS, ...WINDOWS_AD_PATTERNS];
  const foundUrls = new Set<string>();

  for (const sdk of allSdks) {
    for (const url of sdk.urlPatterns) {
      if (codeContent.includes(url)) {
        foundUrls.add(url);
      }
    }
  }

  return Array.from(foundUrls);
}

// ---------------------------------------------------------------------------
// Browser extension ad injection patterns (Chrome/Firefox)
// ---------------------------------------------------------------------------
export interface BrowserAdSignature {
  name: string;
  description: string;
  permissions: string[];
  jsPatterns: string[];
  urlPatterns: string[];
  htmlPatterns: string[];
}

export const BROWSER_AD_PATTERNS: BrowserAdSignature[] = [
  {
    name: 'Google AdSense Injection',
    description: 'Injects Google AdSense ads into pages via content scripts',
    permissions: ['tabs', 'webRequest', 'webRequestBlocking', 'activeTab', '<all_urls>'],
    jsPatterns: [
      'pagead2.googlesyndication.com',
      'google_ad_client',
      'adsbygoogle',
      'googlesyndication',
      'doubleclick.net',
      'AdSense',
      'google_ad',
      'createElement("script")',
      'createElement(\'script\')',
      '.src = "http',
      '.src=\'http',
    ],
    urlPatterns: [
      'pagead2.googlesyndication.com',
      'googleadservices.com',
      'doubleclick.net',
      'googletagmanager.com',
      'googlesyndication.com',
    ],
    htmlPatterns: [
      'adsbygoogle',
      'google_ad_client',
      'google_ad_slot',
      'ins.adsbygoogle',
    ],
  },
  {
    name: 'Taboola Content Recommendations',
    description: 'Injects Taboola content recommendation widgets',
    permissions: ['tabs', 'webRequest', '<all_urls>'],
    jsPatterns: [
      'taboola.com',
      'taboola',
      '_taboola',
      'Taboola',
      'push-notifications',
      'below-article-thumbnails',
    ],
    urlPatterns: [
      'taboola.com',
      'taboolasyndication.com',
      'trc.taboola.com',
    ],
    htmlPatterns: [
      'taboola',
      'trc_',
      'taboola-widget',
    ],
  },
  {
    name: 'Outbrain Content Recommendations',
    description: 'Injects Outbrain content recommendation widgets',
    permissions: ['tabs', 'webRequest', '<all_urls>'],
    jsPatterns: [
      'outbrain.com',
      'outbrain',
      'Outbrain',
      'OUTBRAIN',
      'ob.init',
    ],
    urlPatterns: [
      'outbrain.com',
      'outbrainimg.com',
      'odb.outbrain.com',
    ],
    htmlPatterns: [
      'outbrain',
      'OUTBRAIN',
      'ob-container',
    ],
  },
  {
    name: 'Amazon Associates / Affiliate Rewriting',
    description: 'Rewrites links to inject Amazon affiliate tags',
    permissions: ['tabs', 'webRequest', 'webRequestBlocking', '<all_urls>'],
    jsPatterns: [
      'amazon.com',
      'amzn.to',
      'affiliate',
      'associates',
      'tag=',
      'amazon-adsystem',
      'link_rewrite',
      'replaceLink',
      'addAffiliate',
    ],
    urlPatterns: [
      'amazon-adsystem.com',
      'associates.amazon.com',
      'ws-na.amazon-adsystem.com',
    ],
    htmlPatterns: [
      'amazon-ad',
      'amazon-ads',
    ],
  },
  {
    name: 'Popup/Redirect Ad Injector',
    description: 'Injects popup ads and page redirects into browsing sessions',
    permissions: ['tabs', 'webRequest', 'webRequestBlocking', 'activeTab', '<all_urls>', 'storage'],
    jsPatterns: [
      'window.open',
      'window.location',
      'XMLHttpRequest',
      'fetch(',
      'popup',
      'popunder',
      'newTab',
      'redirect',
      'createElement("iframe")',
      'createElement(\'iframe\')',
      'display: block',
      'z-index:',
      'position: fixed',
      'position: absolute',
      'onbeforeunload',
      'adblock',
      'ad_block',
      'antiadblock',
      'adBlocker',
    ],
    urlPatterns: [
      'popads.net',
      'popcash.net',
      'propellerads.com',
      'adsterra.com',
      'clickaine.com',
      'evadav.com',
      'adhall.com',
      'galaksion.com',
      'trafficstars.com',
      'exoclick.com',
      'juicyads.com',
      'plugrush.com',
      'ad-maven.com',
      'adnow.com',
      'mgid.com',
      'revcontent.com',
    ],
    htmlPatterns: [
      'popup',
      'popunder',
      'popup-ad',
      'popupAd',
    ],
  },
  {
    name: 'Tracking Pixel / Analytics Injector',
    description: 'Injects tracking pixels and analytics beacons for ad attribution',
    permissions: ['tabs', 'webRequest', '<all_urls>'],
    jsPatterns: [
      'new Image()',
      '1x1',
      'pixel',
      'tracking',
      'beacon',
      'navigator.sendBeacon',
      'fbq(',
      'pixel.gif',
      'pixel.png',
      'track.gif',
      'conversion',
      'retargeting',
    ],
    urlPatterns: [
      'facebook.com/tr',
      'connect.facebook.net',
      'bat.bing.com',
      'analytics.twitter.com',
      'pixel.adsafeprotected.com',
      'moatads.com',
      'adsafeprotected.com',
      'scorecardresearch.com',
      'quantcount.com',
      'quantserve.com',
      'bluekai.com',
      'exelator.com',
      'demdex.net',
      'adnxs.com',
      'rubiconproject.com',
      'criteo.com',
      'criteo.net',
      'casalemedia.com',
      'openx.net',
      'pubmatic.com',
      'contextweb.com',
    ],
    htmlPatterns: [
      'noscript',
      'img width="1"',
      'img height="1"',
      'pixel',
      'tracking-pixel',
    ],
  },
  {
    name: 'Cryptominer / Malicious Ad Script',
    description: 'Injects cryptomining scripts or other malicious ad payloads',
    permissions: ['tabs', 'webRequest', '<all_urls>', 'storage'],
    jsPatterns: [
      'CoinHive',
      'coinhive',
      'CryptoLoot',
      'JSEcoin',
      'WebMine',
      'miner',
      'cryptonight',
      'wasm',
      'WebAssembly',
      'miner.start',
    ],
    urlPatterns: [
      'coinhive.com',
      'crypto-loot.com',
      'jsecoin.com',
      'webmine.pro',
      'minero.cc',
      'cryptaloot.pro',
      'coinimp.com',
      'authedmine.com',
    ],
    htmlPatterns: [
      'miner',
      'coinhive',
      'webminer',
    ],
  },
  {
    name: 'Sponsored Results Injector',
    description: 'Injects sponsored search results or shopping links',
    permissions: ['tabs', 'webRequest', 'storage', '<all_urls>'],
    jsPatterns: [
      'sponsored',
      'adResult',
      'searchAds',
      'shoppingAds',
      'priceComparison',
      'injectAd',
      'insertAd',
      'showAd',
      'displayAd',
      'renderAd',
    ],
    urlPatterns: [
      'skimlinks.com',
      'skimresources.com',
      'viglink.com',
      'sovrn.com',
      'shareasale.com',
      'cj.com',
      'avantlink.com',
      'flexoffers.com',
      'pepperjam.com',
      'rakuten.com',
      'linksynergy.com',
      'tradedoubler.com',
      'awin1.com',
      'zanox.com',
    ],
    htmlPatterns: [
      'ad-container',
      'adContainer',
      'sponsored-result',
      'shopping-ad',
    ],
  },
];

// Convert browser ad signatures to the generic AdSdkSignature format for detection
export function browserSignatureToAdSdk(sig: BrowserAdSignature): AdSdkSignature {
  return {
    name: sig.name,
    packagePatterns: sig.urlPatterns,
    classPatterns: [...sig.jsPatterns, ...sig.htmlPatterns],
    methodPatterns: [],
    manifestPatterns: sig.permissions,
    urlPatterns: sig.urlPatterns,
  };
}

// ---------------------------------------------------------------------------
// Windows Store App ad patterns (MSIX / APPX)
// ---------------------------------------------------------------------------
export interface WindowsAdSignature {
  name: string;
  description: string;
  dllPatterns: string[];
  manifestPatterns: string[];
  urlPatterns: string[];
  xamlPatterns: string[];
}

export const WINDOWS_AD_PATTERNS: WindowsAdSignature[] = [
  {
    name: 'Microsoft Advertising SDK',
    description: 'Microsoft Store ads via Microsoft Advertising SDK',
    dllPatterns: [
      'Microsoft.Advertising.dll',
      'Microsoft.Advertising.JS',
      'Microsoft.Advertising.winmd',
      'AdMediator.dll',
      'Microsoft.AdMediator',
    ],
    manifestPatterns: [
      'Microsoft.Advertising',
      'AdMediator',
      'AdControl',
      'InterstitialAd',
      'Microsoft.Store',
    ],
    urlPatterns: [
      'ads.microsoft.com',
      'ads1.msads.net',
      'ads2.msads.net',
      'msads.net',
    ],
    xamlPatterns: [
      '<UI:AdControl',
      '<AdControl',
      'xmlns:UI="using:Microsoft.Advertising',
      'AdControl.ApplicationId',
      'AdControl.AdUnitId',
      'InterstitialAd',
    ],
  },
  {
    name: 'Google AdMob (Windows)',
    description: 'Google AdMob SDK for Windows/UWP apps',
    dllPatterns: [
      'GoogleAds.dll',
      'GoogleMobileAds.dll',
      'Google.Ads.dll',
    ],
    manifestPatterns: [
      'GoogleAds',
      'GoogleMobileAds',
      'AdMob',
    ],
    urlPatterns: [
      'googleadservices.com',
      'googlesyndication.com',
      'doubleclick.net',
    ],
    xamlPatterns: [
      'GoogleAdView',
      'GoogleAds',
      'AdMob',
    ],
  },
  {
    name: 'Unity Ads (Windows)',
    description: 'Unity Ads SDK for Windows apps',
    dllPatterns: [
      'UnityEngine.Advertisements.dll',
      'UnityEngine.Ads.dll',
      'UnityAds.dll',
    ],
    manifestPatterns: [
      'UnityAds',
      'Advertisement',
      'UnityEngine.Advertisements',
    ],
    urlPatterns: [
      'unityads.unity3d.com',
      'unity3d.com',
    ],
    xamlPatterns: [
      'UnityAds',
      'Advertisement.Show',
      'UnityEngine.Advertisements',
    ],
  },
  {
    name: 'AdDuplex (Windows)',
    description: 'Cross-promotion and ad network for Windows apps',
    dllPatterns: [
      'AdDuplex.dll',
      'AdDuplex.WinRT.dll',
      'AdDuplex.Win10.dll',
    ],
    manifestPatterns: [
      'AdDuplex',
      'AdDuplexAd',
    ],
    urlPatterns: [
      'adduplex.com',
      'ads.adduplex.com',
    ],
    xamlPatterns: [
      '<adduplex:AdControl',
      'AdDuplex',
    ],
  },
  {
    name: 'Smaato (Windows)',
    description: 'Smaato ad network SDK for Windows',
    dllPatterns: [
      'Smaato.dll',
      'SmaatoSDK.dll',
    ],
    manifestPatterns: [
      'Smaato',
      'SmaatoSDK',
    ],
    urlPatterns: [
      'smaato.net',
      'smaato.com',
    ],
    xamlPatterns: [
      'SmaatoAd',
    ],
  },
  {
    name: 'AdMob Mediation / PubCenter',
    description: 'Microsoft PubCenter / AdMob mediation for Windows',
    dllPatterns: [
      'Microsoft.PubCenter.dll',
      'Microsoft.AdMediator',
      'AdMediator.dll',
    ],
    manifestPatterns: [
      'PubCenter',
      'AdMediator',
      'Microsoft.PubCenter',
      'MSAdControl',
    ],
    urlPatterns: [
      'ads1.msads.net',
      'pubcenter.microsoft.com',
    ],
    xamlPatterns: [
      '<MSAdControl',
      '<PubCenter',
    ],
  },
];

// Convert windows ad signatures to the generic AdSdkSignature format
export function windowsSignatureToAdSdk(sig: WindowsAdSignature): AdSdkSignature {
  return {
    name: sig.name,
    packagePatterns: sig.dllPatterns,
    classPatterns: [...sig.dllPatterns, ...sig.xamlPatterns],
    methodPatterns: [],
    manifestPatterns: sig.manifestPatterns,
    urlPatterns: sig.urlPatterns,
  };
}

// ---------------------------------------------------------------------------
// Detection helpers for browser / windows patterns
// ---------------------------------------------------------------------------

export function detectBrowserAdPatterns(
  jsContent: string,
  manifestJsonContent: string,
  htmlContent: string
): { sig: BrowserAdSignature; matches: string[] }[] {
  const detected: { sig: BrowserAdSignature; matches: string[] }[] = [];
  const combinedJs = jsContent.toLowerCase();
  const combinedManifest = manifestJsonContent.toLowerCase();
  const combinedHtml = htmlContent.toLowerCase();

  for (const sig of BROWSER_AD_PATTERNS) {
    const matches: string[] = [];

    // Check permissions in manifest
    for (const perm of sig.permissions) {
      if (combinedManifest.includes(perm.toLowerCase())) {
        matches.push(`permission:${perm}`);
      }
    }

    // Check JS patterns
    for (const pattern of sig.jsPatterns) {
      if (combinedJs.includes(pattern.toLowerCase())) {
        matches.push(`js:${pattern}`);
      }
    }

    // Check URL patterns in any content
    for (const url of sig.urlPatterns) {
      if (combinedJs.includes(url.toLowerCase()) ||
          combinedManifest.includes(url.toLowerCase()) ||
          combinedHtml.includes(url.toLowerCase())) {
        matches.push(`url:${url}`);
      }
    }

    // Check HTML patterns
    for (const pattern of sig.htmlPatterns) {
      if (combinedHtml.includes(pattern.toLowerCase()) ||
          combinedJs.includes(pattern.toLowerCase())) {
        matches.push(`html:${pattern}`);
      }
    }

    if (matches.length > 0) {
      detected.push({ sig, matches });
    }
  }

  return detected;
}

export function detectWindowsAdPatterns(
  dllNames: string[],
  manifestXmlContent: string,
  xamlContent: string
): { sig: WindowsAdSignature; matches: string[] }[] {
  const detected: { sig: WindowsAdSignature; matches: string[] }[] = [];
  const dllLower = dllNames.map(d => d.toLowerCase());
  const manifestLower = manifestXmlContent.toLowerCase();
  const xamlLower = xamlContent.toLowerCase();

  for (const sig of WINDOWS_AD_PATTERNS) {
    const matches: string[] = [];

    // Check DLL patterns
    for (const dll of sig.dllPatterns) {
      const dllLow = dll.toLowerCase();
      if (dllLower.some(d => d.includes(dllLow) || d === dllLow)) {
        matches.push(`dll:${dll}`);
      }
    }

    // Check manifest
    for (const pattern of sig.manifestPatterns) {
      if (manifestLower.includes(pattern.toLowerCase())) {
        matches.push(`manifest:${pattern}`);
      }
    }

    // Check XAML
    for (const pattern of sig.xamlPatterns) {
      if (xamlLower.includes(pattern.toLowerCase())) {
        matches.push(`xaml:${pattern}`);
      }
    }

    // Check URLs
    for (const url of sig.urlPatterns) {
      if (manifestLower.includes(url.toLowerCase()) ||
          xamlLower.includes(url.toLowerCase())) {
        matches.push(`url:${url}`);
      }
    }

    if (matches.length > 0) {
      detected.push({ sig, matches });
    }
  }

  return detected;
}
