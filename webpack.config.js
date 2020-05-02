const path = require('path');

module.exports = {
    entry: './src/index.js',
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, 'dist'),
    },
    module: {
        rules: [
            {
                test: /\.wasm$/i,
                type: 'javascript/auto',
                use: [
                    {
                        loader: 'file-loader',
                    }
                ]
            }
        ]
    }
}
