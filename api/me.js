import { getStaffInfo } from './_lib.js';
export default async function handler(req, res) {
  const s = await getStaffInfo(req);
  return res.status(200).json({ staff: !!s, name: s ? s.name : '', owner: !!(s && s.owner) });
}
