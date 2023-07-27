# Contributing to the WindingTree Market Protocol SDK

## Contribution Guidelines

Thank you for considering contributing to the WindingTree Market Protocol SDK! Before you start, please take a moment to review the following guidelines to ensure a smooth and efficient contribution process.

### Code of Conduct

Please note that we have a Code of Conduct in place to foster an open and welcoming community. By participating in this project, you agree to abide by its terms. You can find the Code of Conduct [here](./CODE_OF_CONDUCT.md). TBD

### Creating Pull Requests (PRs)

As a contributor, you are expected to fork this repository, work on your own fork, and then submit pull requests. The pull requests will be reviewed and eventually merged into the main repository. Here's how you can do it:

1. Make sure your fork is up to date with the main repository:

```bash
# Replace `market-sdk` with the name of your local clone of the forked repository
cd market-sdk
git remote add upstream https://github.com/windingtree/sdk.git
git fetch upstream
git pull --rebase upstream master
```

2. Branch out from `master` into `fix/some-bug`:

```bash
git checkout -b fix/some-bug
```

3. Make your changes, add your files, test, commit, and push to your fork.

> It is required to follow the [conventional commits](https://www.conventionalcommits.org) specification when making commits.

```bash
git add SomeFile.ts
git commit -m "fix(package-name): Fixed some bug"
git push origin fix/some-bug
```

> It is recommended to use `pnpm commit` helper function to make beautiful conventional commits

4. Run tests, linter, etc.

```bash
pnpm test
pnpm lint
```

5. Go to [github.com/windingtree/sdk/pulls](https://github.com/windingtree/sdk/pulls) in your web browser and issue a new pull request.

## Pull Request Template

> TBD

We appreciate your contributions to the WindingTree Market Protocol SDK. Happy coding!
