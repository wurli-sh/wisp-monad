# 1D internal audit review

The deployment code is fail-closed and never substitutes a token. The final
manifest is created exclusively from mined broadcast receipts and refuses to
overwrite an existing manifest. The wrapper also refuses to deploy while an
unresolved pending manifest exists, preventing accidental duplicate broadcasts.

Remaining exit blockers:

- Confirm Circle's address again from its official documentation at deployment.
- Use a funded named Foundry keystore and a distinct controlled admin.
- Verify the generated verifier and all four pools on a supported explorer.
- Pre-fund multiple demo wallets with Circle testnet USDC and MON.
- Record a live deposit, real proof, claim, gas usage, transaction hashes, and
  explorer links in this directory.
