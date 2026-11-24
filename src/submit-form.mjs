const HUBSPOT_FORM_ENDPOINT = 'https://api.hsforms.com/submissions/v3/integration/submit';

export class HubSpotSubmissionError extends Error {
	constructor(status) {
		super(`HubSpot rejected the form submission with status ${status}.`);
		this.name = 'HubSpotSubmissionError';
		this.status = status;
	}
}

export function hubSpotSubmissionPayload(data, context = {}) {
	return {
		submittedAt: Date.now().toString(),
		fields: [
			{ objectTypeId: '0-1', name: 'firstname', value: data.firstName },
			{ objectTypeId: '0-1', name: 'lastname', value: data.lastName },
			{ objectTypeId: '0-1', name: 'email', value: data.email },
			{ objectTypeId: '0-1', name: 'message', value: data.message },
		],
		context: {
			pageName: context.pageName,
			pageUri: context.pageUri,
			...(typeof context.hutk === 'string' && /^[a-f0-9]{32}$/.test(context.hutk) ? {hutk: context.hutk} : {}),
		},
	};
}

export async function submitHubSpotForm({
	portalId,
	formGuid,
	data,
	context,
	signal,
	fetchImpl = fetch,
}) {
	if (!/^[1-9]\d*$/.test(String(portalId)) || typeof formGuid !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(formGuid)) {
		throw new TypeError('A valid HubSpot portal ID and form GUID are required.');
	}
	signal?.throwIfAborted();
	const response = await fetchImpl(
		`${HUBSPOT_FORM_ENDPOINT}/${encodeURIComponent(portalId)}/${encodeURIComponent(formGuid)}`,
		{
			method: 'POST',
			redirect: 'manual',
			signal,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(hubSpotSubmissionPayload(data, context)),
		},
	);

	if (!response.ok) {
		throw new HubSpotSubmissionError(response.status);
	}

	return response.json().catch(() => null);
}

export function createHubSpotRecorder({ portalId, formGuids }) {
	const routes = { ...formGuids };
	return ({ kind, data, context, fetchImpl, signal }) => {
		if (!Object.hasOwn(routes, kind)) throw new TypeError('No HubSpot form is configured for this submission kind.');
		return submitHubSpotForm({ portalId, formGuid: routes[kind], data, context, fetchImpl, signal });
	};
}
