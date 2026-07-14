// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {PoseidonInsertBench} from "../src/benchmark/PoseidonInsertBench.sol";

contract PoseidonInsertBenchTest is Test {
    PoseidonInsertBench internal bench;
    uint256 internal constant GAS_LIMIT = 30_000_000;
    uint256 internal constant INSERT_GATE_BPS = 4000; // 40%

    function setUp() public {
        bench = new PoseidonInsertBench();
    }

    function test_insertGasUnderGate() public {
        uint256 gasBefore = gasleft();
        bench.insert(uint256(keccak256("leaf-0")));
        uint256 used = gasBefore - gasleft();
        emit log_named_uint("depth-20 insert gas (stub hasher)", used);
        assertLt(used, (GAS_LIMIT * INSERT_GATE_BPS) / 10_000, "insert exceeds 40% of 30M");
    }

    function test_secondInsertAlsoUnderGate() public {
        bench.insert(uint256(keccak256("leaf-0")));
        uint256 gasBefore = gasleft();
        bench.insert(uint256(keccak256("leaf-1")));
        uint256 used = gasBefore - gasleft();
        emit log_named_uint("second insert gas (stub hasher)", used);
        assertLt(used, (GAS_LIMIT * INSERT_GATE_BPS) / 10_000);
    }
}
