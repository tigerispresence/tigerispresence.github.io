const changes = [
    -1.2, -1.1, -0.5, 0.0, 0.1, 0.5, 1.2, 1.5, 2.0, 0.15, -0.15
];

const min = Math.floor(Math.min(...changes));
const max = Math.ceil(Math.max(...changes));
const binSize = 0.1;
const bins = {};

console.log(`Min: ${min}, Max: ${max}, BinSize: ${binSize}`);

// Initialize bins
for (let i = min; i <= max; i += binSize) {
    bins[i.toFixed(1)] = 0;
}

console.log("Initialized bins count:", Object.keys(bins).length);

changes.forEach(change => {
    const bin = (Math.floor(change / binSize) * binSize).toFixed(1);
    if (bins[bin] !== undefined) bins[bin]++;
    else {
        bins[bin] = 1;
        console.log(`Added new bin: ${bin}`);
    }
});

const chartData = Object.entries(bins).map(([bin, count]) => ({
    bin: parseFloat(bin),
    count
})).sort((a, b) => a.bin - b.bin);

console.log("Chart Data Sample:", chartData.filter(d => d.count > 0));
console.log("Total Data Points:", chartData.reduce((a, b) => a + b.count, 0));
