import {base64URLToBytes} from "../convert";
import {GMTDate as Date} from "../dates";
import {Log} from "../logs";

const idTokendecoded = [
  'iss',
  'aud',
  'exp',
  'nbf',
  'iat',
  'jti',
  'azp',
  'nonce',
  'auth_time',
  'at_hash',
  'c_hash',
  'acr',
  'amr',
  'sub_jwk',
  'cnf',
  'sip_from_tag',
  'sip_date',
  'sip_callid',
  'sip_cseq_num',
  'sip_via_branch',
  'orig',
  'dest',
  'mky',
  'events',
  'toe',
  'txn',
  'rph',
  'sid',
  'vot',
  'vtm'
];

export const decode = (token, leeway) => {
  const [header, payload, signature] = token.split('.');
  const claims = JSON.parse(base64URLToBytes(payload));
  Log.warning("did not verfy signature");

  const now = Date.now().unix();
  if (now > claims.exp + leeway) Log.error("Token expired");
  if (now < claims.iat - leeway) Log.error("Token was issued in future");
  if (now < claims.nbf - leeway) Log.error("Token not valid yet");

  return {
    encoded: { header, payload, signature },
    header: JSON.parse(base64URLToBytes(header)),
    claims
  };
};

