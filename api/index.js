const app = require('../backend/app');
const { bootstrap } = require('../backend/bootstrap');

module.exports = async (req, res) => {
  await bootstrap();
  return app(req, res);
};
