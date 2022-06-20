# Auto Release

Generate releases with automatic changelog creation from your commit history. Currently the usage focus is on the PR closing event and will currently be tested in this use case.

- The source-branch is used to find the commits since the last time a tag was created.
- The target-branch is used to increase to the correct version number, depending on the properties major-branch, minor-branch and patch-branch.
- The with-description can be set to add the commit message body to the release notes. Otherwise just the message header is used.

Example if you increase the major version manually:

```yaml
  - name: Auto release generation with changelog
    uses: OrellBuehler/auto-release@v1-beta
    with:
      token: ${{ secrets.GITHUB_TOKEN }}
      target-branch: ${{ github.ref_name }}
      source-branch: ${{ github.head_ref }}
      with-description: true
      minor-branch: main
      patch-branch: dev
```

Example if you increase the major version automatically:

```yaml
  - name: Auto release generation with changelog
    uses: OrellBuehler/auto-release@v1-beta
    with:
      token: ${{ secrets.GITHUB_TOKEN }}
      target-branch: ${{ github.ref_name }}
      source-branch: ${{ github.head_ref }}
      with-description: true
      major-branch: main
      minor-branch: dev
      patch-branch: feature
```
