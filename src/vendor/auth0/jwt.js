import {base64URLToBytes} from "../convert";
import {GMTDate as Date} from "../dates";
import {Log} from "../logs";


export const decode = (token, leeway) => {
  const [header, payload, signature] = token.split('.');
  const claims = JSON.parse(base64URLToBytes(payload));
  Log.warning("did not verify signature");

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

