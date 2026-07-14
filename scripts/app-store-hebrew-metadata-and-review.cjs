const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const eas = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8'));
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
const ios = eas.submit.production.ios;

const APP_ID = ios.ascAppId;
const KEY_ID = ios.ascApiKeyId;
const ISSUER_ID = ios.ascApiKeyIssuerId;
const KEY_PATH = ios.ascApiKeyPath;
const VERSION = appJson.expo.version;

const metadata = {
  name: '\u05e4\u05e1\u05d9\u05db\u05d5\u05d8\u05db\u05e0\u05d9 \u05e4\u05dc\u05d5\u05e1',
  subtitle: '\u05ea\u05e8\u05d2\u05d5\u05dc \u05e4\u05e1\u05d9\u05db\u05d5\u05d8\u05db\u05e0\u05d9 \u05d7\u05db\u05dd',
  promotionalText: '\u05ea\u05e8\u05d2\u05d5\u05dc \u05e4\u05e1\u05d9\u05db\u05d5\u05d8\u05db\u05e0\u05d9 \u05d1\u05e2\u05d1\u05e8\u05d9\u05ea \u05e2\u05dd \u05e9\u05d0\u05dc\u05d5\u05ea \u05de\u05e1\u05d5\u05e0\u05db\u05e8\u05e0\u05d5\u05ea, \u05d4\u05e1\u05d1\u05e8\u05d9\u05dd, \u05de\u05d1\u05d7\u05e0\u05d9\u05dd \u05d7\u05db\u05de\u05d9\u05dd \u05d5\u05de\u05e2\u05e7\u05d1 \u05d4\u05ea\u05e7\u05d3\u05de\u05d5\u05ea.',
  description: '\u05e4\u05e1\u05d9\u05db\u05d5\u05d8\u05db\u05e0\u05d9 \u05e4\u05dc\u05d5\u05e1 \u05d4\u05d9\u05d0 \u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d9\u05ea \u05ea\u05e8\u05d2\u05d5\u05dc \u05dc\u05de\u05d1\u05d7\u05e0\u05d9\u05dd \u05e4\u05e1\u05d9\u05db\u05d5\u05d8\u05db\u05e0\u05d9\u05d9\u05dd. \u05d4\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05db\u05d5\u05dc\u05dc\u05ea \u05ea\u05e8\u05d2\u05d5\u05dc \u05d1\u05d7\u05e9\u05d9\u05d1\u05d4 \u05dc\u05d5\u05d2\u05d9\u05ea, \u05d7\u05e9\u05d9\u05d1\u05d4 \u05db\u05de\u05d5\u05ea\u05d9\u05ea, \u05d7\u05e9\u05d9\u05d1\u05d4 \u05de\u05d9\u05dc\u05d5\u05dc\u05d9\u05ea \u05d5\u05e6\u05d5\u05e8\u05d5\u05ea \u05d5\u05de\u05e8\u05d7\u05d1. \u05d4\u05e9\u05d0\u05dc\u05d5\u05ea \u05de\u05e0\u05d5\u05d4\u05dc\u05d5\u05ea \u05d1\u05de\u05e2\u05e8\u05db\u05ea \u05e0\u05d9\u05d4\u05d5\u05dc, \u05d5\u05e8\u05e7 \u05e9\u05d0\u05dc\u05d5\u05ea \u05e9\u05d0\u05d5\u05e9\u05e8\u05d5 \u05de\u05d5\u05e4\u05d9\u05e2\u05d5\u05ea \u05dc\u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd.\\n\\n\u05de\u05d4 \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4:\\n\u2022 \u05ea\u05e8\u05d2\u05d5\u05dc \u05dc\u05e4\u05d9 \u05e0\u05d5\u05e9\u05d0\u05d9\u05dd \u05d5\u05e8\u05de\u05d5\u05ea \u05e7\u05d5\u05e9\u05d9\\n\u2022 \u05d4\u05e1\u05d1\u05e8\u05d9\u05dd \u05dc\u05e9\u05d0\u05dc\u05d5\u05ea \u05dc\u05d0\u05d7\u05e8 \u05de\u05e2\u05e0\u05d4\\n\u2022 \u05de\u05d1\u05d7\u05e0\u05d9\u05dd \u05d7\u05db\u05de\u05d9\u05dd \u05dc\u05de\u05e0\u05d5\u05d9\u05d9 \u05e4\u05e8\u05d9\u05de\u05d9\u05d5\u05dd\\n\u2022 \u05de\u05e2\u05e7\u05d1 \u05d0\u05d7\u05e8 \u05d4\u05ea\u05e7\u05d3\u05de\u05d5\u05ea, \u05d3\u05d9\u05d5\u05e7 \u05d5\u05e8\u05e6\u05e3 \u05ea\u05e8\u05d2\u05d5\u05dc\\n\u2022 \u05de\u05e1\u05da \u05e4\u05e0\u05d9\u05d5\u05ea \u05dc\u05ea\u05de\u05d9\u05db\u05d4 \u05d5\u05de\u05e2\u05e0\u05d4 \u05de\u05e0\u05d4\u05dc\\n\\n\u05d4\u05ea\u05d5\u05db\u05df \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05de\u05d9\u05d5\u05e2\u05d3 \u05dc\u05ea\u05e8\u05d2\u05d5\u05dc \u05d5\u05dc\u05d4\u05db\u05e0\u05d4 \u05e2\u05e6\u05de\u05d9\u05ea.',
  whatsNew: '\u05e9\u05d9\u05e4\u05e8\u05e0\u05d5 \u05d0\u05ea \u05de\u05d0\u05d2\u05e8 \u05d4\u05e9\u05d0\u05dc\u05d5\u05ea, \u05ea\u05d9\u05e7\u05e0\u05d5 \u05d4\u05e1\u05d1\u05e8\u05d9\u05dd, \u05d4\u05e1\u05e8\u05e0\u05d5 \u05e9\u05d0\u05dc\u05d5\u05ea \u05e9\u05dc\u05d0 \u05d0\u05d5\u05e9\u05e8\u05d5 \u05de\u05d4\u05ea\u05e8\u05d2\u05d5\u05dc, \u05d7\u05d9\u05d6\u05e7\u05e0\u05d5 \u05e1\u05e0\u05db\u05e8\u05d5\u05df \u05de\u05d5\u05dc \u05de\u05e1\u05db\u05d9 \u05d4\u05e0\u05d9\u05d4\u05d5\u05dc, \u05d5\u05e9\u05d9\u05e4\u05e8\u05e0\u05d5 \u05d0\u05ea \u05d4\u05ea\u05d0\u05de\u05ea \u05d4\u05de\u05e1\u05db\u05d9\u05dd \u05dc\u05e0\u05d9\u05d9\u05d3 \u05d5\u05dc\u05de\u05d7\u05e9\u05d1.',
  keywords: '\u05e4\u05e1\u05d9\u05db\u05d5\u05d8\u05db\u05e0\u05d9,\u05ea\u05e8\u05d2\u05d5\u05dc,\u05de\u05d1\u05d7\u05df,\u05dc\u05d5\u05d2\u05d9\u05e7\u05d4,\u05db\u05de\u05d5\u05ea\u05d9,\u05de\u05d9\u05dc\u05d5\u05dc\u05d9,\u05e6\u05d5\u05e8\u05d5\u05ea,\u05de\u05e8\u05d7\u05d1',
  supportUrl: 'https://psychotechniplus.com/support',
  marketingUrl: 'https://psychotechniplus.com',
};

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function token() {
  const privateKey = fs.readFileSync(KEY_PATH, 'utf8');
  const header = { alg: 'ES256', kid: KEY_ID, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: ISSUER_ID, iat: now, exp: now + 20 * 60, aud: 'appstoreconnect-v1' };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const sig = crypto.sign('sha256', Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${base64url(sig)}`;
}

async function api(method, endpoint, body) {
  const response = await fetch(`https://api.appstoreconnect.apple.com${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = json?.errors?.map(error => `${error.status} ${error.code}: ${error.detail || error.title}`).join('\n') || text;
    const err = new Error(`${method} ${endpoint} failed:\n${message}`);
    err.status = response.status;
    err.body = json;
    throw err;
  }
  return json;
}

function noBadText(value) {
  return typeof value === 'string' && /[\u0590-\u05ff]/.test(value) && !value.includes('???') && !/ג'יבריש|gibberish/i.test(value);
}

async function getEditableVersion() {
  const endpoint = `/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&limit=20`;
  const versions = (await api('GET', endpoint)).data ?? [];
  const exact = versions.find(version => version.attributes.versionString === VERSION);
  return exact ?? versions.find(version => !['READY_FOR_SALE', 'PROCESSING_FOR_APP_STORE'].includes(version.attributes.appStoreState)) ?? versions[0];
}

async function ensureVersionLocalization(versionId) {
  const existing = (await api('GET', `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=20`)).data ?? [];
  const he = existing.find(item => item.attributes.locale === 'he') ?? existing[0];
  if (he) return he;
  return (await api('POST', '/v1/appStoreVersionLocalizations', {
    data: {
      type: 'appStoreVersionLocalizations',
      attributes: { locale: 'he' },
      relationships: {
        appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } },
      },
    },
  })).data;
}

async function updateMetadata(version) {
  for (const [key, value] of Object.entries(metadata)) {
    if (['supportUrl', 'marketingUrl'].includes(key)) continue;
    if (!noBadText(value)) throw new Error(`Metadata field ${key} is not valid Hebrew text.`);
  }

  const loc = await ensureVersionLocalization(version.id);
  await api('PATCH', `/v1/appStoreVersionLocalizations/${loc.id}`, {
    data: {
      id: loc.id,
      type: 'appStoreVersionLocalizations',
      attributes: {
        description: metadata.description,
        keywords: metadata.keywords,
        marketingUrl: metadata.marketingUrl,
        promotionalText: metadata.promotionalText,
        supportUrl: metadata.supportUrl,
        whatsNew: metadata.whatsNew,
      },
    },
  });

  const appInfos = (await api('GET', `/v1/apps/${APP_ID}/appInfos?include=appInfoLocalizations&limit=10`));
  const included = appInfos.included ?? [];
  const appInfoLoc = included.find(item => item.type === 'appInfoLocalizations' && item.attributes.locale === 'he')
    ?? included.find(item => item.type === 'appInfoLocalizations');
  let appInfoWarning = null;
  if (appInfoLoc) {
    try {
      await api('PATCH', `/v1/appInfoLocalizations/${appInfoLoc.id}`, {
        data: {
          id: appInfoLoc.id,
          type: 'appInfoLocalizations',
          attributes: {
            name: metadata.name,
            subtitle: metadata.subtitle,
            privacyPolicyUrl: 'https://psychotechniplus.com/privacy',
          },
        },
      });
    } catch (error) {
      appInfoWarning = error.message;
    }
  }

  return { versionLocalizationId: loc.id, appInfoLocalizationId: appInfoLoc?.id ?? null, appInfoWarning };
}

async function latestBuildCandidate() {
  const builds = (await api('GET', `/v1/builds?filter[app]=${APP_ID}&limit=10&sort=-uploadedDate`)).data ?? [];
  return { candidate: builds[0], builds };
}

async function attachBuild(versionId, build) {
  if (!build || build.attributes.processingState !== 'VALID') {
    return { attached: false, reason: build ? `build_state_${build.attributes.processingState}` : 'no_build' };
  }
  try {
    await api('PATCH', `/v1/appStoreVersions/${versionId}/relationships/build`, {
      data: { type: 'builds', id: build.id },
    });
    return { attached: true, buildId: build.id, buildVersion: build.attributes.version, buildNumber: build.attributes.buildVersion };
  } catch (error) {
    return {
      attached: false,
      reason: 'attach_failed',
      warning: error.message,
      buildId: build.id,
      buildVersion: build.attributes.version,
      buildNumber: build.attributes.buildVersion,
    };
  }
}

async function submitForReview(versionId) {
  try {
    const result = await api('POST', '/v1/appStoreVersionSubmissions', {
      data: {
        type: 'appStoreVersionSubmissions',
        relationships: {
          appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } },
        },
      },
    });
    return { submitted: true, id: result.data.id };
  } catch (error) {
    return { submitted: false, reason: 'submit_failed', warning: error.message };
  }
}

async function main() {
  const shouldSubmit = process.argv.includes('--submit-review');
  const version = await getEditableVersion();
  if (!version) throw new Error('No iOS App Store version found.');
  const metadataResult = await updateMetadata(version);
  const { candidate: build, builds } = await latestBuildCandidate();
  const attachResult = await attachBuild(version.id, build);
  let submitResult = { submitted: false, reason: shouldSubmit ? 'not_attempted' : 'submit_flag_not_set' };
  if (shouldSubmit) submitResult = await submitForReview(version.id);

  const report = {
    appId: APP_ID,
    requestedVersion: VERSION,
    appStoreVersionId: version.id,
    appStoreVersionString: version.attributes.versionString,
    appStoreState: version.attributes.appStoreState,
    metadataResult,
    latestBuild: build ? {
      id: build.id,
      version: build.attributes.version,
      buildVersion: build.attributes.buildVersion,
      processingState: build.attributes.processingState,
      uploadedDate: build.attributes.uploadedDate,
    } : null,
    recentBuilds: builds.map(item => ({
      id: item.id,
      version: item.attributes.version,
      buildVersion: item.attributes.buildVersion,
      processingState: item.attributes.processingState,
      uploadedDate: item.attributes.uploadedDate,
    })),
    attachResult,
    submitResult,
    updatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.join(ROOT, 'outputs'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'outputs', 'app-store-hebrew-metadata-and-review.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => {
  console.error(error.message);
  if (error.body) console.error(JSON.stringify(error.body, null, 2));
  process.exit(1);
});
