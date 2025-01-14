import { default as createTmalign } from './tmalign-wasm.js'
import tmalignWasm from './tmalign-wasm.wasm'

function tmalign(pdb1, pdb2) {
    return new Promise((resolve, reject) => {
        let buffer = "";
        createTmalign({
            locateFile: () => tmalignWasm,
            print: (msg) => buffer += msg + "\n"
        }).then((instance) => {
            instance.FS.writeFile('/pdb1.pdb', pdb1);
            instance.FS.writeFile('/pdb2.pdb', pdb2);
            const err = instance.callMain([
                "/pdb1.pdb",
                "/pdb2.pdb",
            ]);
            if (err == 0) {
                resolve(buffer)
            } else {
                reject(err)
            }
        });
    })
}

function getCigar(seq1, seq2) {
    var op = "";
    var length = 0;
    var cigar = "";
    var seq1Pos = 0;
    var seq2Pos = 0;
    var seq1StartPos = 0;
    var seq2StartPos = 0;
    var firstM = true;
    var queryAligned = "";
    var targetAligned = "";
    for (let i = 0; i < seq1.length; i++) {
        if (seq1[i] != "-" && seq2[i] != "-") {
            if (op != "M" && length != 0) {
                cigar += length + op;
                length = 0;
            }
            op = "M";
            length += 1;
            if (firstM) {
                seq1StartPos = seq1Pos;
                seq2StartPos = seq2Pos;
                queryAligned = "";
                targetAligned = "";
                firstM = false;
                cigar = "";
            }
            queryAligned += seq1[i];
            targetAligned += seq2[i];
            seq1Pos += 1;
            seq2Pos += 1;
        } else {
            if (seq1[i] == "-") {
                if (op != "D" && length != 0) {
                    cigar += length + op;
                    length = 0;
                }
                op = "D";
                queryAligned += "-";
                targetAligned += seq2[i];
                length += 1;
                seq2Pos += 1;
            } else if (seq2[i] == "-") {
                if (op != "I" && length != 0) {
                    cigar += length + op;
                    length = 0;
                }
                op = "I";
                queryAligned += seq1[i];
                targetAligned += "-";
                length += 1;
                seq1Pos += 1;
            }
        }
    }
    if (length != 0) {
        cigar += length + op;
    }
    return { cigar, seq1StartPos, seq2StartPos, queryAligned, targetAligned };
}

function parse(output) {
    const lines = output.split('\n');
    var chain1, chain2, tmScore;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith("Name of Chain_1:")) {
            chain1 = line.split(" ")[3].replace(/^\s+|\s+$/g, '');
        }
        if (line.startsWith("Name of Chain_2:")) {
            chain2 = line.split(" ")[3].replace(/^\s+|\s+$/g, '');
        }
        if (line.startsWith('TM-score=') && line.includes("Chain_1")) {
            tmScore = parseFloat(line.split(" ")[1]);
        }
        if (line.startsWith('(":" denotes')) {
            const { cigar, seq1StartPos, seq2StartPos, queryAligned, targetAligned } 
                = getCigar(lines[i + 1].replace(/^\s+|\s+$/g, ''), lines[i + 3].replace(/^\s+|\s+$/g, ''));
            // iterate over queryAligned and targetAligned at the same time
            let lastMatchIndex = 0;
            let seq1End = 0;
            let seq2End = 0;
            for (let j = 0; j < queryAligned.length; j++) {
                if (queryAligned[j] != '-') {
                    seq1End += 1;
                }
                if (queryAligned[j] != '-') {
                    seq2End += 1;
                }
                if (queryAligned[j] != '-' && targetAligned[j] != '-') {
                    lastMatchIndex = j;
                }
            }

            // find last M in cigar and remove remaining string
            const lastM = cigar.lastIndexOf("M");

            return {
                query: chain1,
                target: chain2,
                qEnd: seq1StartPos + 1,
                qEndPos: seq1StartPos + seq1End + 1,
                dbStartPos: seq2StartPos + 1,
                dbEndPos: seq2StartPos + seq2End + 1,
                cigar: cigar.substring(0, lastM + 1),
                tmScore,
                qAln: queryAligned.substring(0, lastMatchIndex + 1),
                tAln: targetAligned.substring(0, lastMatchIndex + 1)
            };
        }
    }

    return null;
}

export { tmalign, parse };

