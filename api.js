import {validateState} from './data.js';

export class ApiError extends Error {
  constructor(message, status = 0, code = 'NETWORK_ERROR') {
    super(message); this.name = 'ApiError'; this.status = status; this.code = code;
  }
}

/** Authentication stays in memory. No tokens or account records touch browser storage. */
export function createApi(fetcher = globalThis.fetch) {
  let token = null;
  async function request(path, {method = 'GET', body} = {}) {
    let response;
    try {
      response = await fetcher(`/api${path}`, {
        method, credentials: 'omit', cache: 'no-store',
        headers: {...(body === undefined ? {} : {'Content-Type': 'application/json'}), ...(token ? {Authorization: `Bearer ${token}`} : {})},
        ...(body === undefined ? {} : {body: JSON.stringify(body)}),
        signal: AbortSignal.timeout(20000)
      });
    } catch {
      throw new ApiError('Could not reach the account server. Your changes are still here. Check the connection and retry.');
    }
    let result;
    try { result = await response.json(); }
    catch { throw new ApiError('The account API is unavailable at this address. Run the Node server to use accounts.', response.status); }
    if (!response.ok) throw new ApiError(result?.error?.message || 'The request failed. Your changes are still here.', response.status, result?.error?.code);
    return result;
  }
  function envelope(result) {
    validateState(result.state);
    if (!Number.isSafeInteger(result.revision) || result.revision < 0) throw new ApiError('The server returned an invalid planner revision.');
    return result;
  }
  return {
    async authenticate(kind, input) {
      const result = await request(`/auth/${kind}`, {method:'POST', body:input});
      if (typeof result.token !== 'string' || !result.user?.email) throw new ApiError('The server returned an invalid sign-in response.');
      token = result.token;
      return result.user;
    },
    load: async () => envelope(await request('/state')),
    save: async (state, revision) => {
      validateState(state);
      return envelope(await request('/state', {method:'PUT', body:{state,revision}}));
    },
    signOut() { token = null; }
  };
}

/** Revision advances only after a confirmed save; failed writes retain the draft. */
export function createCloudPersistence(api, initial) {
  validateState(initial.state);
  let revision = initial.revision;
  let saved = JSON.stringify(initial.state);
  let conflict = false;
  return {
    get revision() { return revision; },
    get conflict() { return conflict; },
    dirty(state) { return JSON.stringify(state) !== saved; },
    async save(state) {
      if (conflict) throw new ApiError('Newer account records exist. Download your draft, then load the latest account planner before saving.', 409, 'REVISION_CONFLICT');
      const snapshot = structuredClone(state);
      try {
        const result = await api.save(snapshot, revision);
        revision = result.revision;
        saved = JSON.stringify(result.state);
        return result;
      } catch (error) {
        if (error.status === 409) conflict = true;
        throw error;
      }
    }
  };
}
