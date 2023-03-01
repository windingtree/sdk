import 'mocha';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);

process.on('unhandledRejection', (error) => {
  console.log('Unhandled rejection detected:', error);
});

export { expect };
