import assert from 'node:assert/strict';
import test from 'node:test';

import {
	hubSpotSubmissionPayload,
	submitHubSpotForm,
	createHubSpotRecorder,
	HubSpotSubmissionError,
} from '@ehven/messaging-form-connector-hubspot';

const data = {
	firstName: 'Sam',
	lastName: 'Example',
	email: 'sam@example.org',
	message: 'I would like to discuss a project.',
	source: 'contact-page',
};

test('optional visitor association accepts only the public token format', () => {
  assert.equal(hubSpotSubmissionPayload(data, {hutk: 'a'.repeat(32)}).context.hutk, 'a'.repeat(32));
  assert.equal('hutk' in hubSpotSubmissionPayload(data, {hutk: 'private@example.com'}).context, false);
  assert.equal('hutk' in hubSpotSubmissionPayload(data).context, false);
});

test('form routing uses the configured kind and rejects an unknown kind before fetch', async () => {
	const guid = 'a05d1e64-6409-4736-b408-40eaf205b264';
	const record = createHubSpotRecorder({portalId: 1234, formGuids: {request: guid}});
	const signal = new AbortController().signal;
	let calls = 0;
	const fetchImpl = async (url, init) => {
		calls++;
		assert.ok(url.endsWith('/1234/' + guid));
		assert.equal(init.signal, signal);
		assert.equal(init.redirect, 'manual');
		return new Response(null, {status: 204});
	};
	assert.equal(await record({kind:'request', data, signal, fetchImpl}), null);
	assert.throws(() => record({kind:'toString', data, fetchImpl}), /No HubSpot form/);
	await assert.rejects(submitHubSpotForm({portalId:'1234',formGuid:'invalid',data,fetchImpl}), TypeError);
	assert.equal(calls,1);
});

test('rate limit errors expose status only and the connector never retries', async () => {
	let calls = 0;
	await assert.rejects(submitHubSpotForm({
		portalId:'1234',formGuid:'a05d1e64-6409-4736-b408-40eaf205b264',data,
		fetchImpl: async () => { calls++; return new Response('private provider body', {status:429}); },
	}), error => error instanceof HubSpotSubmissionError && error.status === 429 && !error.message.includes('private'));
	assert.equal(calls,1);
});

test('the HubSpot connector maps the portable contact contract', () => {
	const payload = hubSpotSubmissionPayload(data, {
		pageName: 'Contact page',
		pageUri: 'https://example.org/contact/',
	});

	assert.deepEqual(
		payload.fields.map(({ name, value }) => ({ name, value })),
		[
			{ name: 'firstname', value: 'Sam' },
			{ name: 'lastname', value: 'Example' },
			{ name: 'email', value: 'sam@example.org' },
			{ name: 'message', value: 'I would like to discuss a project.' },
		],
	);
	assert.equal(payload.context.pageName, 'Contact page');
});

test('the HubSpot connector uses the configured form endpoint', async () => {
	let request;
	await submitHubSpotForm({
		portalId: '1234567',
		formGuid: 'a05d1e64-6409-4736-b408-40eaf205b264',
		data,
		context: {},
		fetchImpl(url, init) {
			request = { url, init };
			return Promise.resolve(new Response('{}'));
		},
	});

	assert.match(request.url, /1234567\/a05d1e64-6409-4736-b408-40eaf205b264$/);
	assert.equal(request.init.method, 'POST');
});
