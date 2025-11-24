# Set up the project locally

1. Clone the repository
```bash
git clone https://github.com/goat-sdk/goat.git
```

2. Go into the typescript directory
```bash
cd goat/typescript
```

3. Install the dependencies
```bash
pnpm install
```

4. Build the project
```bash
pnpm build
```

Now you can run the examples in the `examples` directory. Follow the README in each example to see how to use the SDK for that specific agent framework.

Every time you make changes to a plugin/wallet/adapter/etc., you will need to run the build command again to use it in the examples.

You can run `pnpm build:libs` to only build the libraries and not the examples.


## Video Installation Guide

<a href="https://www.youtube.com/watch?v=h3tGxd-WSXg">
  <img src="https://github.com/user-attachments/assets/626ebac2-868c-4090-857b-66b47b222a61" width="800" alt="Watch the video"/>
</a>
