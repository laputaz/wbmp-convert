export const decodeWBMP = function (arrayBuffer) {
    // 8 位 8 位地读，也就是一字节一字节地读
    let bytes = new Uint8Array(arrayBuffer)
    // 其实位
    let ptr = 0

    // 读一个字节
    // 0xff => 11111111
    function readOctet() {
        return bytes[ptr++] & 0xff
    }

    // 读取多位
    function readMultiByteInteger() {
        var result = 0
        // eslint-disable-next-line
        while (true) {
            if (result & 0xfe000000) throw 'error parsing integer'
            var b = bytes[ptr++]
            // 左移7位，低位7位补零
            // b取后 7 位，补上取
            result = (result << 7) | (b & 0x7f)
            // 最高位是不是1，是的话继续，不是的话返回（肯定会有一个最高位的0作为多字节数结尾的字节）
            if (!(b & 0x80)) return result
        }
    }

    try {
        // We only support image type 0: B/W, no compression
        if (readMultiByteInteger() != 0) return false
        // We don't expect any extended headers here.
        if (readOctet() != 0) return false
        var width = readMultiByteInteger()
        var height = readMultiByteInteger()
        // Reject incorrect image dimensions.
        if (width == 0 || width > 65535 || height == 0 || height > 65535)
            return false
        // Create a canvas to draw the pixels into.
        var canvas = document.createElement('canvas')
        canvas.setAttribute('width', width)
        canvas.setAttribute('height', height)
        var ctx = canvas.getContext('2d')
        var imageData = ctx.createImageData(width, height)
        var data = imageData.data
        // Decode the image.
        for (var y = 0; y < height; ++y) {
            for (var x = 0; x < width; x += 8) {
                var bits = bytes[ptr++]
                var w = (y * width + x) * 4
                // rgba
                // eslint-disable-next-line
                function write(bit) {
                    var color = bit ? 255 : 0
                    data[w++] = color
                    data[w++] = color
                    data[w++] = color
                    data[w++] = 255 // 透明度，不透明
                }

                write(bits & 0x80)
                write(bits & 0x40)
                write(bits & 0x20)
                write(bits & 0x10)
                write(bits & 0x08)
                write(bits & 0x04)
                write(bits & 0x02)
                write(bits & 0x01)
            }
        }
        if (ptr > bytes.length) return null
        // Update the canvas pixels.
        ctx.putImageData(imageData, 0, 0)
        // Convert to an image.
        return canvas.toDataURL('image/png')
    } catch (e) {
        // Error occured.
        return null
    }
}
