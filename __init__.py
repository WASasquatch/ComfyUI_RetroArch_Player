WEB_DIRECTORY = "./web"


class ComfyRetroArchPlayer:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}

    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "run"
    CATEGORY = "fun"

    def run(self):
        return ()


NODE_CLASS_MAPPINGS = {
    "ComfyRetroArchPlayer": ComfyRetroArchPlayer,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyRetroArchPlayer": "RetroArch Player",
}
