pragma circom 2.0.0;

include "../common/jubjub.circom";

component main {public [x, s]} = ecDecompress();