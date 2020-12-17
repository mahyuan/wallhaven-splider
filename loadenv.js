const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');

module.exports = function () {
  const env = dotenv.config();
  dotenvExpand(env);
};