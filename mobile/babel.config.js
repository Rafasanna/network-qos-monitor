module.exports = api => {
  api.cache.using(() => process.env.QOS_BACKEND_URL || '');
  const backendUrl = process.env.QOS_BACKEND_URL || '';

  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      ({types}) => ({
        visitor: {
          MemberExpression(path) {
            if (path.matchesPattern('process.env.QOS_BACKEND_URL')) {
              path.replaceWith(types.stringLiteral(backendUrl));
            }
          },
        },
      }),
    ],
  };
};
