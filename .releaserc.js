module.exports = {
    plugins: [
      [
        "semantic-release-monorepo",
        {
          packages: [
            "packages/tree-chart-core",
            "packages/vue3-tree-chart"
          ]
        }
      ]
    ]
  };
  