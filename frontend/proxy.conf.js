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
 * Dev-server proxy: forwards `/api` from `ng serve` to the API server.
 *
 * The target is read from the environment so that no address or port is
 * committed to the repository. Set API_PROXY_TARGET (or HOST / PORT, which the
 * API server itself also reads) to match your local setup.
 */
const host = process.env.API_PROXY_HOST || '127.0.0.1';
const port = process.env.API_PROXY_PORT || process.env.PORT || '3000';
const target = process.env.API_PROXY_TARGET || `http://${host}:${port}`;

module.exports = {
  '/api': {
    target,
    secure: false,
    changeOrigin: true,
  },
};
