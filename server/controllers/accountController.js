// server/controllers/transactionController.js
import Transaction from '../models/Transaction.js';
import Account     from '../models/Account.js';

/** ☑️ עזר פנימי לעדכון יתרה */
async function adjustBalance(accountId, diff) {
  await Account.findByIdAndUpdate(accountId, { $inc: { balance: diff } });
}

/** GET /api/transactions?from=yyyy-mm-dd&to=yyyy-mm-dd&category=... */
export async function getAll(req, res) {
  const { from, to, category } = req.query;
  const filter = { userId: req.user._id };
  if (from && to)  filter.date = { $gte: new Date(from), $lte: new Date(to) };
  if (category && category !== 'כל הקטגוריות') filter.category = category;
  const data = await Transaction.find(filter).sort({ date: -1 });
  res.json(data);
}

/** POST /api/transactions */
export async function create(req, res) {
  const { date, type, category, amount, description, accountId } = req.body;
  if (!date || !amount)
    return res.status(400).json({ msg: 'תאריך וסכום חובה' });

  const doc = await Transaction.create({
    userId: req.user._id,
    date,
    type,
    category,
    amount,
    description,
    account: accountId,
  });

  await adjustBalance(
    accountId,
    type === 'הכנסה' ? amount : -amount
  );

  res.status(201).json(doc);
}

/** PUT /api/transactions/:id */
export async function update(req, res) {
  const { id } = req.params;
  const trx = await Transaction.findOne({ _id: id, userId: req.user._id });
  if (!trx) return res.status(404).json({ msg: 'לא נמצא' });

  // החזר את היתרה הישנה
  await adjustBalance(
    trx.account,
    trx.type === 'הכנסה' ? -trx.amount : trx.amount
  );

  // עדכון שדות מותרים
  Object.assign(trx, req.body);
  await trx.save();

  // עדכן יתרה חדשה
  await adjustBalance(
    trx.account,
    trx.type === 'הכנסה' ? trx.amount : -trx.amount
  );

  res.json(trx);
}

/** DELETE /api/transactions/:id */
export async function remove(req, res) {
  const { id } = req.params;
  const trx = await Transaction.findOneAndDelete({
    _id: id,
    userId: req.user._id,
  });
  if (!trx) return res.status(404).json({ msg: 'לא נמצא' });

  await adjustBalance(
    trx.account,
    trx.type === 'הכנסה' ? -trx.amount : trx.amount
  );

  res.json({ ok: true });
}
export default { getAll, create, update, remove };