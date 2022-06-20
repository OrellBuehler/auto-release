# Auto Release

Generate releases with automatic changelog creation from your commit history.

Example if you increase the major version manually:

```yaml
  - name: Auto release generation with changelog
    uses: OrellBuehler/auto-release@v1-alpha
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
    uses: OrellBuehler/auto-release@v1-alpha
    with:
      token: ${{ secrets.GITHUB_TOKEN }}
      target-branch: ${{ github.ref_name }}
      source-branch: ${{ github.head_ref }}
      with-description: true
      major-branch: main
      minor-branch: dev
      patch-branch: feature
```
