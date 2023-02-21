from simple_image_download import simple_image_download as simp

response = simp.simple_image_download
response.directory = '/server/datasets/simple'

response().download(keywords = "dragonfly, butterfly,ladybug", limit = 10) 