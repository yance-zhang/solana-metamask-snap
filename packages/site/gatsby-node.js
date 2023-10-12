exports.onCreateWebpackConfig = ({ actions, getConfig }) => {
  const config = getConfig();
  if (config.externals && config.externals[0]) {
    config.externals[0]['node:crypto'] = require.resolve('crypto-browserify');
  }
  actions.replaceWebpackConfig(config);
};
