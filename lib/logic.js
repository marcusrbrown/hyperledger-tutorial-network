'use strict';
/**
 * Transaction logic.
 *
 * @author Marcus R. Brown <me@igetgam.es>
 */

/**
 * Trade a commodity from one trader to another
 * @param {org.acme.biznet.Trade} trade - the trade to be processed
 * @transaction
 */
function tradeCommodity(trade) {
  var oldOwner = trade.commodity.owner;

  trade.commodity.owner = trade.newOwner;

  return getAssetRegistry('org.acme.biznet.Commodity')
    .then(function (commodityRegistry) {
      return commodityRegistry.update(trade.commodity);
    })
    .then(function () {
      var tradeEvent = getFactory().newEvent('org.acme.biznet', 'TradeEvent');

      tradeEvent.commodity = trade.commodity;
      tradeEvent.oldOwner = oldOwner;
      emit(tradeEvent);
    });
}
