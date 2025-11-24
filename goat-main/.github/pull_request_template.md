<!-- Use this template by filling in information and copy and pasting relevant items out of the html comments. -->

# Relates to:

<!-- LINK TO ISSUE OR TICKET -->

# Background

## What does this PR do?

# Testing
<!-- Steps for the reviewer to test these changes -->

## Detailed testing results
<!-- 
Show that you've tested each function on your plugin/adapter/wallet. To do so simply:
1. Go to the examples directory and choose an example to test with
2. Import your plugin/wallet/adapter
3. Test each action and fill the table below with a screenshot and an example transaction showing that your changes worked
4. Don't push any changes to the example dir
-->

| Method | Prompt | Screenshot | Transaction Link |
|----------|--------|-------|------------------|
| Action #1 | Prompt to get it to take that action | Screenshot of the result | Transaction link |
| Action #2 | Prompt to get it to take that action | Screenshot of the result | Transaction link |


# Docs
<!--
My changes do not require a change to the project documentation.
My changes require a change to the project documentation.
If a docs change is needed: I have updated the documentation accordingly.
-->

## Checklist
- [ ] I have tested this change and added the relevant screenshots to the PR description
- [ ] I updated the [README](https://github.com/goat-sdk/goat/blob/main/README.md) if necessary to include the new plugin, wallet, chain, etc.

If you require releasing a new version of the package:
- [ ] I have added a changset for the specific package by running `pnpm change:add` from the `typescript` directory
