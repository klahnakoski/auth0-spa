import * as ClientStorage from './storage';

const COOKIE_KEY = 'a0.spajs.txs.';
const getTransactionKey = (state) => `${COOKIE_KEY}${state}`;

export default class TransactionManager {
  transactions;
  constructor() {
    this.transactions = {};
    ClientStorage.getAllKeys()
      .filter(k => k.startsWith(COOKIE_KEY))
      .forEach(k => {
        const state = k.replace(COOKIE_KEY, '');
        this.transactions[state] = ClientStorage.get(k);
      });
  }
  create(state, transaction) {
    this.transactions[state] = transaction;
    ClientStorage.save(getTransactionKey(state), transaction, {
      daysUntilExpire: 1
    });
  }
  get(state) {
    return this.transactions[state];
  }
  remove(state) {
    delete this.transactions[state];
    ClientStorage.remove(getTransactionKey(state));
  }
}
