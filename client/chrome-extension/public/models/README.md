# Local BlazeFace weights

`blazeface.onnx` is downloaded from the Hugging Face repository:

<https://huggingface.co/garavv/blazeface-onnx>

The model card documents RGB 128×128 input, NCHW tensor layout, and BlazeFace
face-box/score outputs. SHA-256 for the checked-in file:

```text
564740C5146673C840257402CEE8309161848E48E64D277A862AB4D501ADF8A5
```

The detector runs entirely inside the extension. The weights and input images
are never uploaded to the FastAPI gateway. Review the upstream model terms
before redistributing a production release; the upstream model card does not
declare a separate SPDX license.
