# wbmp-convert

将 wbmp 转换为 png

## 背景

`admin`需要做一个对接 `google ads` 的工具, 以简化市场同事在做广告投放时做的一些重复性操作。
其中涉及到一个流程: 将图片/zip/视频上传到服务端存储, 上传前需要校验图片的尺寸是否符合要求。 其中有一种图片格式是 `wbmp` , 这种格式浏览器并不支持, 所以需要转换成 `png`，再去判断尺寸。其中就涉及到了 js 中的二进制转换。

## 什么是 wbmp

wbmp 是一种图像格式，只支持 1 位颜色，即 wbmp 图像只包含黑色和白色像素。
但目前 chrome 、Safari 都不支持，估计是比较陈旧的格式了，在前端使用的场景太少了，几乎没有见到。

## wbmp 的存储形式（文件结构）

wbmp 包含头部和图片数据：

头部：

- 第一个字节表示图片类型，目前只有 0，即非压缩的黑白位图。
- 第二个字节固定是 0
- 第三个字节开始，是图片的宽和高，使用**多字节整数**格式存储。

> 多字节整数：一个多字节整数由一个或多个字节构成，每个字节的左边第一位表示后边的字节是否为当前整数的一部分。如果当前字节的左边第一位为 0，表示后面没有更多的字节了，该多字节整数结束；如果当前字节的左边第一位为 1，表示后边的字节也用来构成该多字节整数。

图片数据：

- 剩下就是图像数据了，每一个 bit 表示一个像素：1 表示白色，0 表示黑色。

示意图：
<img src="https://img-blog.csdnimg.cn/2b933efcf7ab44f7b08679725c4b1e22.png" width=200px/>

## 思路

- 将 wbmp 读取为 arraybuffer，以读取二进制数据。
- 读取 wbmp 文件的宽高。
- 新建一个 canvas，设置画布的宽高。
- canvas 绘制图片时，每个像素由 rgba 四个值组成，因为只有黑白，则读取成
  - 255，255，255，255 白色
  - 0，0，0，0，255 黑色
- 输出图片 DataURI

## 实现

#### 写一个 input，type=file，用于选择文件，并绑定选择事件，将选择的文件转换为 ObjectUrl 提供给 img

```html
<input type="file" />
<hr />
<img src="" alt="no img yet" width="300" height="200" />
<script type="module">
  const inputElement = document.querySelector('input')
  inputElement.addEventListener('change', function (e) {
    let img = document.querySelector('img')
    img.src = URL.createObjectURL(e.target.files[0])
  })
</script>
```

- 选择正常的图片，展示没有问题
  <img src="https://img-blog.csdnimg.cn/4b6ca5888bdd44d5ab883d93b64d862b.png" width=400/>

- 选择 wbmp 文件，可以看到，Chrome 并不支持。
  <img src="https://img-blog.csdnimg.cn/d1b10e3094be4954a95a55067c77b5de.png" width=300/>

#### 改造一下，引入 wbmp.js 文件，暴露一个方法。

- 该方法接受 ArrayBuffer 对象，转换成 png, 最终返回 png 的 dataURI。

```html
<input type="file" />
<hr />
<img src="" alt="no img yet" width="300" height="200" />
<script type="module">
  // 暴露一个方法 decodeWBMP
  import { decodeWBMP } from './wbmp.js'
  const inputElement = document.querySelector('input')
  // 绑定事件
  inputElement.addEventListener('change', function (e) {
    // 读取图片
    let img = document.querySelector('img')
    let reader = new FileReader()
    // 读取为 ArrayBuffer
    reader.readAsArrayBuffer(e.target.files[0])
    reader.onloadend = function (e) {
      // 返回一个 dataURI
      img.src = decodeWBMP(e.target.result)
    }
  })
</script>
```

#### 实现 wbmp.js

1. 入口

```js
export const decodeWBMP = function (arrayBuffer) {
  // ...
  // ...
  // 最终返回 dataURI
  return dataURI
}
```

1. 先建立一个视图，该视图每 8 位读取 arrayBuffer

```js
// 8 位 8 位地读，也就是一字节一字节地读
let bytes = new Uint8Array(arrayBuffer)
// 起始字节 index
let ptr = 0
```

2. 定义一个方法，读取前两个字节，前面提到，这两个字节必须是 0

```js
// 读一个字节
function readOctet() {
  return bytes[ptr++]
}

try {
  // 以 0 开始
  if (readOctet() != 0) return false
  // 第二位也是 0
  if (readOctet() != 0) return false
} catch {
  return null
}
```

3. 从第三位开始，读取多字节整数。

- 最后一个字节如果是以 0 开头，则结束
- 否则循环，拼接除了最高位以外的后续位
- 返回整数

代码

```js
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

//...
//...
// 紧接上个步骤
// 以 0 开始
if (readOctet() != 0) return false
// 第二位也是 0
if (readOctet() != 0) return false
// 读取宽度
let width = readMultiByteInt()
// 读取高度
let height = readMultiByteInt()
```

以 426 为例，存储状态为两个字节：1000001100101010，分析状态如图:

<img src="https://img-blog.csdnimg.cn/df4f30c554014c0c9c7349e58fe10983.png" width=600/>

<br />
<br />

剩下的数据就是图片的像素点了！

4. 知道了宽高，画一个 canvas 画布，并 createImageData 拿到图片数据：

```js
// 建立一个 canvas，并建立一个图片数据
let canvas = document.createElement('canvas')
canvas.setAttribute('width', width)
canvas.setAttribute('height', height)
let ctx = canvas.getContext('2d')
let imageData = ctx.createImageData(width, height)
let data = imageData.data
```

5. 接下来，往图片列**逐行**填充像素点，首先要知道 canvas imageData，每 4 位表示一个像素点，表示 R、G、B、A。例如一个只有 2 个像素点的 canvas 图片，data 数组为:

<img src="https://img-blog.csdnimg.cn/6c035130228b4e0880b8300828a75ba6.png" width=500 />

我们还需要一个知识，**按位与**可以用得知对应位置是否为 0。

例如：5 & 4 即 0b101 & 0b100 得到 4，则知道 5 的二进制的第 3 位不是 0
例如：5 & 2 即 0b101 & 0b010 得到 0，则知道 5 的二进制的第 2 位是 0

代码：

```js
// 设置图片数据
// rgba
function write(bit) {
  // 当前位不为0，则是白色，否则填充黑色
  let color = bit ? 255 : 0
  data[w++] = color // r
  data[w++] = color // g
  data[w++] = color // b
  data[w++] = 255 // a 透明度，不透明
}

// 从上到下遍历每一行
for (let y = 0; y < height; ++y) {
  // 从左到右遍历每一列的像素点。
  // 每一个字节有 8 位，可以填充8个像素点，所以每次循环 +8
  for (let x = 0; x < width; x += 8) {
    // 一个字节 8 位
    let bits = bytes[ptr++]
    // 计算填充位置
    let w = (y * width + x) * 4

    // 8位，取每一位，判断当前位是否为 0
    write(bits & 0x80) // 0x80 即 10000000
    write(bits & 0x40) // 0x40 即 1000000
    write(bits & 0x20) // 0x20 即 100000
    write(bits & 0x10) // 类推
    write(bits & 0x08) // ...
    write(bits & 0x04)
    write(bits & 0x02)
    write(bits & 0x01)
  }
}
```

6. 填充完以后，输出 dataURI

```js
// 从 0 位置开始写
ctx.putImageData(imageData, 0, 0)
// 转换为 DataURI
return canvas.toDataURL('image/png')
```

7. 完整代码:

```js
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
```

#### 效果

<img src="https://img-blog.csdnimg.cn/58255211ea8140f3a054e9e097893112.png" width=500/>

## 以上

