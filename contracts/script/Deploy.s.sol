// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {WispPool} from "../src/WispPool.sol";
import {Groth16Verifier} from "../src/generated/Groth16Verifier.sol";
import {PoseidonT3Deployer} from "../src/poseidon/PoseidonT3Deployer.sol";

/// @notice Fail-closed Monad testnet deployment. Invoke with Foundry's named --account.
contract Deploy is Script {
    uint256 public constant MONAD_TESTNET_CHAIN_ID = 10143;
    address public constant CIRCLE_USDC = 0x534b2f3A21130d7a60830c2Df862319e593943A3;
    bytes32 public constant CIRCUIT_ID = 0xb615da4b4eb2693502e7da531e51e7450572c8c2083105ef2f5898b38ad38745;

    error WrongChain(uint256 actual);
    error InvalidAdmin();
    error AdminIsDeployer();
    error CircleUsdcCodeMissing();
    error CircleUsdcDecimals(uint8 actual);
    error VerifierCodeHashMismatch(bytes32 actual);
    error PostDeployAssertion();

    struct Deployment {
        address verifier;
        address poseidon;
        address pool1;
        address pool10;
        address pool50;
        address pool100;
    }

    function validateEnvironment(address admin) public view {
        if (block.chainid != MONAD_TESTNET_CHAIN_ID) revert WrongChain(block.chainid);
        if (admin == address(0)) revert InvalidAdmin();
        if (CIRCLE_USDC.code.length == 0) revert CircleUsdcCodeMissing();

        uint8 actualDecimals = IERC20Metadata(CIRCLE_USDC).decimals();
        if (actualDecimals != 6) revert CircleUsdcDecimals(actualDecimals);
    }

    function run() external returns (Deployment memory deployed) {
        address admin = vm.envAddress("WISP_ADMIN_ADDRESS");
        validateEnvironment(admin);
        address[] memory deployerWallets = vm.getWallets();
        for (uint256 i = 0; i < deployerWallets.length; i++) {
            if (admin == deployerWallets[i]) revert AdminIsDeployer();
        }

        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();
        if (admin == deployer) revert AdminIsDeployer();
        deployed.poseidon = PoseidonT3Deployer.deploy();
        deployed.verifier = address(new Groth16Verifier());
        bytes32 expectedVerifierCodeHash = keccak256(type(Groth16Verifier).runtimeCode);
        if (deployed.verifier.codehash != expectedVerifierCodeHash) {
            revert VerifierCodeHashMismatch(deployed.verifier.codehash);
        }

        deployed.pool1 = address(new WispPool(CIRCLE_USDC, deployed.verifier, deployed.poseidon, 1_000_000, admin));
        deployed.pool10 = address(new WispPool(CIRCLE_USDC, deployed.verifier, deployed.poseidon, 10_000_000, admin));
        deployed.pool50 = address(new WispPool(CIRCLE_USDC, deployed.verifier, deployed.poseidon, 50_000_000, admin));
        deployed.pool100 = address(new WispPool(CIRCLE_USDC, deployed.verifier, deployed.poseidon, 100_000_000, admin));
        vm.stopBroadcast();

        _assertPool(deployed.pool1, deployed, admin, 1_000_000);
        _assertPool(deployed.pool10, deployed, admin, 10_000_000);
        _assertPool(deployed.pool50, deployed, admin, 50_000_000);
        _assertPool(deployed.pool100, deployed, admin, 100_000_000);
        _writePendingManifest(deployed, admin);

        console2.log("Circle USDC", CIRCLE_USDC);
        console2.log("Verifier", deployed.verifier);
        console2.log("PoseidonT3", deployed.poseidon);
        console2.log("1 USDC pool", deployed.pool1);
        console2.log("10 USDC pool", deployed.pool10);
        console2.log("50 USDC pool", deployed.pool50);
        console2.log("100 USDC pool", deployed.pool100);
    }

    function _assertPool(address poolAddress, Deployment memory deployed, address admin, uint256 expectedDenomination)
        private
        view
    {
        WispPool pool = WispPool(poolAddress);
        if (
            address(pool.token()) != CIRCLE_USDC || address(pool.verifier()) != deployed.verifier
                || address(pool.poseidon()) != deployed.poseidon || pool.denomination() != expectedDenomination
                || !pool.hasRole(pool.DEFAULT_ADMIN_ROLE(), admin) || !pool.hasRole(pool.PAUSER_ROLE(), admin)
                || pool.circuitId() != CIRCUIT_ID
        ) revert PostDeployAssertion();
    }

    function _writePendingManifest(Deployment memory deployed, address admin) private {
        string memory key = "wisp-deployment";
        vm.serializeUint(key, "chainId", MONAD_TESTNET_CHAIN_ID);
        vm.serializeAddress(key, "admin", admin);
        vm.serializeAddress(key, "token", CIRCLE_USDC);
        vm.serializeAddress(key, "verifier", deployed.verifier);
        vm.serializeAddress(key, "poseidon", deployed.poseidon);
        vm.serializeAddress(key, "pool1", deployed.pool1);
        vm.serializeAddress(key, "pool10", deployed.pool10);
        vm.serializeAddress(key, "pool50", deployed.pool50);
        string memory json = vm.serializeAddress(key, "pool100", deployed.pool100);
        vm.writeJson(json, string.concat(vm.projectRoot(), "/../deployments/10143.pending.json"));
    }
}
