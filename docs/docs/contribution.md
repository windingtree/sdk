# Contributing to the WindingTree Market Protocol SDK

## Contribution guidelines

> TBD

## Creating Pull Requests (PRs)

As a contributor, you are expected to fork this repository, work on your own fork and then submit pull requests. The pull requests will be reviewed and eventually merged into the main repo. See ["Fork-a-Repo"](https://help.github.com/articles/fork-a-repo/) for how this works.

## A typical workflow

1. Make sure your fork is up to date with the main repository:

> `market-sdk` is your local clone of the forked repository

```bash
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

> Making commits it is required to follow the [conventional commits](https://www.conventionalcommits.org) specification

```bash
git add SomeFile.js
git commit "fix(package-name): Fixed some bug"
git push origin fix/some-bug
```

1. Run tests, linter, etc.

```bash
yarn test
yarn lint
```

5. Go to [github.com/windingtree/sdk/pulls](https://github.com/windingtree/sdk/pulls) in your web browser and issue a new pull request.

## PR template

> TBD
