import { getStaff } from './_lib.js';
export default function handler(req, res) {
  const u = getStaff(req);
  return res.status(200).json({ staff: !!u, name: u || '' });
}
