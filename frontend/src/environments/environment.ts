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

/**
 * Front-end runtime configuration.
 *
 * `apiBaseUrl` is a same-origin relative path by default, so no host, address
 * or port is baked into the build:
 *   - production: the API server also serves this bundle, so `/api` resolves
 *     straight to it;
 *   - development: `ng serve` forwards `/api` to the API server using
 *     `proxy.conf.js`, which reads its target from the environment.
 *
 * Point this at an absolute URL only when the API is hosted separately, and
 * add that origin to `CORS_ORIGINS` on the server when you do.
 */
export const environment = {
  apiBaseUrl: '/api',
};
