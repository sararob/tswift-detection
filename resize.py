# Copyright 2017 Google LLC

# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at

#     https://www.apache.org/licenses/LICENSE-2.0

# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from __future__ import division
from __future__ import print_function
from __future__ import absolute_import

import argparse
import os
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('--image_dir', help='Directory of images to resize')
args = parser.parse_args()

image_dir = os.getcwd() + "/" + args.image_dir

for f in os.listdir(image_dir):
    filename = os.fsdecode(f)
    image = Image.open(image_dir + '/' + filename)
    print(image_dir + '/' + filename)
    height, width = image.size
    if width > 600:
        resize_amt = 600 / width
        new_height = int(round(height * resize_amt))
        image = image.resize((new_height, 600))
        image.save(os.getcwd() + "/" + image_dir + "/" + filename)
