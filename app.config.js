// Lê o app.json e injeta o número do build (versionCode) vindo do GitHub Actions.
// Cada build novo precisa de versionCode maior para o Android aceitar a atualização.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    versionCode: Number(process.env.XPV_BUILD_NUMBER || 1),
  },
});
