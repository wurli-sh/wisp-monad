// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Deploy} from "../script/Deploy.s.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract DeployTest is Test {
    Deploy internal script;
    MockUSDC internal mock;

    function setUp() public {
        script = new Deploy();
        mock = new MockUSDC();
    }

    function test_rejectsWrongChain() public {
        vm.expectRevert(abi.encodeWithSelector(Deploy.WrongChain.selector, 31337));
        script.validateEnvironment(address(1));
    }

    function test_rejectsMissingCircleCode() public {
        vm.chainId(10143);
        vm.expectRevert(Deploy.CircleUsdcCodeMissing.selector);
        script.validateEnvironment(address(1));
    }

    function test_acceptsExactCircleAddressWithSixDecimals() public {
        vm.etch(script.CIRCLE_USDC(), address(mock).code);
        vm.chainId(10143);
        script.validateEnvironment(address(1));
    }

    function test_rejectsZeroAdmin() public {
        vm.etch(script.CIRCLE_USDC(), address(mock).code);
        vm.chainId(10143);
        vm.expectRevert(Deploy.InvalidAdmin.selector);
        script.validateEnvironment(address(0));
    }
}
