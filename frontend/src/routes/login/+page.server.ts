import { fail, redirect, type RequestEvent } from '@sveltejs/kit';

import type { Actions, PageServerLoad, RouteParams } from './$types';
import { getRandomBackground, getRandomQuote } from '$lib';
import { fetchCSRFToken } from '$lib/index.server';
const PUBLIC_SERVER_URL = process.env['PUBLIC_SERVER_URL'];

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) {
		return redirect(302, '/');
	} else {
		const quote = getRandomQuote();
		const background = getRandomBackground();

		return {
			props: {
				quote,
				background
			}
		};
	}
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const formUsername = formData.get('username');
		const username = formUsername?.toString().toLowerCase();
		const password = formData.get('password');
		const totp = formData.get('totp');

		const serverEndpoint = PUBLIC_SERVER_URL || 'http://localhost:8000';
		const csrfToken = await fetchCSRFToken();

		// Initial login attempt
		const loginFetch = await event.fetch(`${serverEndpoint}/_allauth/browser/v1/auth/login`, {
			method: 'POST',
			headers: {
				'X-CSRFToken': csrfToken,
				'Content-Type': 'application/json',
				Cookie: `csrftoken=${csrfToken}`
			},
			body: JSON.stringify({ username, password }),
			credentials: 'include'
		});

		if (loginFetch.status === 200) {
			// Login successful without MFA
			handleSuccessfulLogin(event, loginFetch);
			return redirect(302, '/');
		} else if (loginFetch.status === 401) {
			// MFA required
			if (!totp) {
				return fail(401, {
					message: 'settings.mfa_required',
					mfa_required: true
				});
			} else {
				// Attempt MFA authentication
				const sessionId = extractSessionId(loginFetch.headers.get('Set-Cookie'));
				const mfaLoginFetch = await event.fetch(
					`${serverEndpoint}/_allauth/browser/v1/auth/2fa/authenticate`,
					{
						method: 'POST',
						headers: {
							'X-CSRFToken': csrfToken,
							'Content-Type': 'application/json',
							Cookie: `csrftoken=${csrfToken}; sessionid=${sessionId}`
						},
						body: JSON.stringify({ code: totp }),
						credentials: 'include'
					}
				);

				if (mfaLoginFetch.ok) {
					// MFA successful
					handleSuccessfulLogin(event, mfaLoginFetch);
					return redirect(302, '/');
				} else {
					// MFA failed
					const mfaLoginResponse = await mfaLoginFetch.json();
					return fail(401, {
						message: mfaLoginResponse.error || 'settings.invalid_code',
						mfa_required: true
					});
				}
			}
		} else {
			// Login failed
			const loginResponse = await loginFetch.json();
			const firstKey = Object.keys(loginResponse)[0] || 'error';
			const error = loginResponse[firstKey][0] || 'settings.invalid_credentials';
			return fail(400, { message: error });
		}
	}
};

function handleSuccessfulLogin(event: RequestEvent<RouteParams, '/login'>, response: Response) {
	const setCookieHeader = response.headers.get('Set-Cookie');
	if (setCookieHeader) {
		const sessionIdRegex = /sessionid=([^;]+).*?expires=([^;]+)/;
		const match = setCookieHeader.match(sessionIdRegex);
		if (match) {
			const [, sessionId, expiryString] = match;
			event.cookies.set('sessionid', sessionId, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: true,
				expires: new Date(expiryString)
			});
		}
	}
}

function extractSessionId(setCookieHeader: string | null) {
	if (setCookieHeader) {
		const sessionIdRegex = /sessionid=([^;]+)/;
		const match = setCookieHeader.match(sessionIdRegex);
		return match ? match[1] : '';
	}
	return '';
}
