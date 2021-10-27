export const decodeWBMP = function (arrayBuffer) {
    // 8 位 8 位地读，也就是一字节一字节地读
    let bytes = new Uint8Array(arrayBuffer)
    // 其实位
    let ptr = 0

    // 读一个字节 ptr++
    function readOctet() {
        return bytes[ptr++]
    }


    // 读取多字节整数
    function readMultiByteInt() {
        let result = 0
        while (true) {
            // 读取下一位
            let next = bytes[ptr++]
            // 左移7位 => 低位7位补零
            result = result << 7
            // next & 0b01111111 表示最高位变0，其余位置保留
            result = result | (next & 0b01111111)
            // 判断最高位是不是0，是的话结束。（肯定会有一个最高位为0的字节，作为多字节数结尾的字节）
            if (!(next & 0b10000000)) {
                return result
            }
        }
    }

    try {
        // 以 0 开始
        if (readOctet() != 0) return false
        // 第二位也是 0
        if (readOctet() != 0) return false
        let width = readMultiByteInt()
        let height = readMultiByteInt()
        // 建立一个 canvas
        let canvas = document.createElement('canvas')
        canvas.setAttribute('width', width)
        canvas.setAttribute('height', height)
        let ctx = canvas.getContext('2d')
        let imageData = ctx.createImageData(width, height)
        let data = imageData.data
        // 设置图片数据
        for (let y = 0; y < height; ++y) {
            for (let x = 0; x < width; x += 8) {
                let bits = bytes[ptr++]
                let w = (y * width + x) * 4
                // rgba
                function write(bit) {
                    let color = bit ? 255 : 0
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
        // 从 0 位置开始写
        ctx.putImageData(imageData, 0, 0)
        // 转换为 DataURI
        return canvas.toDataURL('image/png')
    } catch (e) {
        // 出错了
        return null
    }
}
