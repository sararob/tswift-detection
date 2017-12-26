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

import os
import io
import xml.etree.ElementTree as ET
import tensorflow as tf

from object_detection.utils import dataset_util
from PIL import Image


flags = tf.app.flags
flags.DEFINE_string('output_path', '', 'Path to output TFRecord')
flags.DEFINE_string('images_dir', '', 'Path to directory of images')
flags.DEFINE_string('labels_dir', '', 'Path to directory of labels')
FLAGS = flags.FLAGS


def create_tf_example(example):

    image_path = os.getcwd() + '/' +  FLAGS.images_dir + example
    labels_path = os.getcwd() + '/' +  FLAGS.labels_dir + os.path.splitext(example)[0] + '.xml'

    # Read the image
    img = Image.open(image_path)
    width, height = img.size
    img_bytes = io.BytesIO()
    img.save(img_bytes, format=img.format)

    height = height
    width = width
    encoded_image_data = img_bytes.getvalue()
    image_format = img.format.encode('utf-8')

    # Read the label XML
    tree = ET.parse(labels_path)
    root = tree.getroot()
    xmins = xmaxs = ymins = ymaxs = list()

    for coordinate in root.find('object').iter('bndbox'):
        xmins = [int(coordinate.find('xmin').text)]
        xmaxs = [int(coordinate.find('xmax').text)]
        ymins = [int(coordinate.find('ymin').text)]
        ymaxs = [int(coordinate.find('ymax').text)]

    classes_text = ['tswift'.encode('utf-8')]
    classes = [1]

    tf_example = tf.train.Example(features=tf.train.Features(feature={
        'image/height': dataset_util.int64_feature(height),
        'image/width': dataset_util.int64_feature(width),
        'image/filename': dataset_util.bytes_feature(encoded_image_data),
        'image/source_id': dataset_util.bytes_feature(encoded_image_data),
        'image/encoded': dataset_util.bytes_feature(encoded_image_data),
        'image/format': dataset_util.bytes_feature(image_format),
        'image/object/bbox/xmin': dataset_util.float_list_feature(xmins),
        'image/object/bbox/xmax': dataset_util.float_list_feature(xmaxs),
        'image/object/bbox/ymin': dataset_util.float_list_feature(ymins),
        'image/object/bbox/ymax': dataset_util.float_list_feature(ymaxs),
        'image/object/class/text': dataset_util.bytes_list_feature(classes_text),
        'image/object/class/label': dataset_util.int64_list_feature(classes),
    }))
    return tf_example


def main(_):
    writer = tf.python_io.TFRecordWriter(FLAGS.output_path)

    for filename in os.listdir(FLAGS.images_dir):
        tf_example = create_tf_example(filename)
        writer.write(tf_example.SerializeToString())

    writer.close()


if __name__ == '__main__':
    tf.app.run()
