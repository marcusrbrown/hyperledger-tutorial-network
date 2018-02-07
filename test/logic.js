'use strict';
/**
 * Write the unit tests for your transction processor functions here
 */

const AdminConnection = require('composer-admin').AdminConnection;
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const BusinessNetworkDefinition = require('composer-common').BusinessNetworkDefinition;
const IdCard = require('composer-common').IdCard;
const MemoryCardStore = require('composer-common').MemoryCardStore;

const path = require('path');

require('chai').should();

const namespace = 'org.acme.biznet';
const assetType = 'SampleAsset';

describe('#' + namespace, () => {
  // In-memory card store for testing so cards are not persisted to the file system
  const cardStore = new MemoryCardStore();
  let adminConnection;
  let businessNetworkConnection;

  before(() => {
    // Embedded connection used for local testing
    const connectionProfile = {
      name: 'embedded',
      type: 'embedded'
    };
    // Embedded connection does not need real credentials
    const credentials = {
      certificate: 'FAKE CERTIFICATE',
      privateKey: 'FAKE PRIVATE KEY'
    };

    // PeerAdmin identity used with the admin connection to deploy business networks
    const deployerMetadata = {
      version: 1,
      userName: 'PeerAdmin',
      roles: [ 'PeerAdmin', 'ChannelAdmin' ]
    };
    const deployerCard = new IdCard(deployerMetadata, connectionProfile);
    deployerCard.setCredentials(credentials);

    const deployerCardName = 'PeerAdmin';
    adminConnection = new AdminConnection({ cardStore: cardStore });

    return adminConnection.importCard(deployerCardName, deployerCard).then(() => {
      return adminConnection.connect(deployerCardName);
    });
  });

  beforeEach(() => {
    businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });

    const adminUserName = 'admin';
    let adminCardName;
    let businessNetworkDefinition;

    return BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..')).then(definition => {
      businessNetworkDefinition = definition;
      // Install the Composer runtime for the new business network
      return adminConnection.install(businessNetworkDefinition.getName());
    }).then(() => {
      // Start the business network and configure an network admin identity
      const startOptions = {
        networkAdmins: [
          {
            userName: adminUserName,
            enrollmentSecret: 'adminpw'
          }
        ]
      };
      return adminConnection.start(businessNetworkDefinition, startOptions);
    }).then(adminCards => {
      // Import the network admin identity for us to use
      adminCardName = `${adminUserName}@${businessNetworkDefinition.getName()}`;
      return adminConnection.importCard(adminCardName, adminCards.get(adminUserName));
    }).then(() => {
      // Connect to the business network using the network admin identity
      return businessNetworkConnection.connect(adminCardName);
    });
  });

  describe('#tradeCommodity', () => {
    it('should be able to trade a commodity', () => {
      const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

      // Create the traders
      const trader1 = factory.newResource(namespace, 'Trader', 'omcdonald@eieio.com');
      const trader2 = factory.newResource(namespace, 'Trader', 'me@igetgam.es');

      trader1.firstName = 'Old';
      trader1.lastName = 'McDonald';
      trader2.firstName = 'Marcus R.';
      trader2.lastName = 'Brown';

      // Create the commodities
      const commodity1 = factory.newResource(namespace, 'Commodity', 'EMA');
      const commodity2 = factory.newResource(namespace, 'Commodity', 'XYZ');

      commodity1.description = 'Corn';
      commodity1.mainExchange = 'Euronext';
      commodity1.quantity = 100;
      commodity1.owner = factory.newRelationship(namespace, 'Trader', trader1.$identifier);
      commodity2.description = 'Soya';
      commodity2.mainExchange = 'Chicago';
      commodity2.quantity = 50;
      commodity2.owner = factory.newRelationship(namespace, 'Trader', trader1.$identifier);

      // Create the trade transaction
      const trade = factory.newTransaction(namespace, 'Trade');

      trade.newOwner = factory.newRelationship(namespace, 'Trader', trader2.$identifier);
      trade.commodity = factory.newRelationship(namespace, 'Commodity', commodity1.$identifier);

      return businessNetworkConnection.getAssetRegistry(namespace + '.Commodity')
        .then((commodityRegistry) => {
          return commodityRegistry.addAll([commodity1, commodity2])
            .then(() => {
              return businessNetworkConnection.getParticipantRegistry(namespace + '.Trader');
            })
            .then((participantRegistry) => {
              return participantRegistry.addAll([trader1, trader2]);
            })
            .then(() => {
              return businessNetworkConnection.submitTransaction(trade);
            })
            .then(() => {
              return businessNetworkConnection.getAssetRegistry(namespace + '.Commodity');
            })
            .then ((commodityRegistry) => {
              return commodityRegistry.get(commodity1.$identifier);
            })
            .then((commodity) => {
              commodity.owner.$identifier.should.equal(trader2.$identifier);
            });
        });
    });
  });
});
