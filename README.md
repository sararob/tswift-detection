Building, training, and serving a TensorFlow Object Detection model
===================================================================

*This is not an official Google product.*

This repo contains the code from [this blog post](https://medium.com/@srobtweets/build-a-taylor-swift-detector-with-the-tensorflow-object-detection-api-ml-engine-and-swift-82707f5b4a56) explaining how I built a Taylor Swift detector using the [TensorFlow object detection API](https://github.com/tensorflow/models/tree/master/research/object_detection), [Cloud ML Engine](http://cloud.google.com/ml-engine), and the Firebase SDKs for Cloud Functions and Cloud Storage. It looks like this:

![gif-screenshot](/screenshots/find-taylor.gif)

See the blog post for details and follow the steps below to build, train, and serve your detector.

## Preprocessing images and converting to TFRecords

Before generating bounding box labels for my images, I resized them to a width of <= 600px. To resize your images run:

`python resize.py --image_dir=PATH_TO_YOUR_IMG_DIRECTORY`

Then split your images into training and test sets. I hand-labeled images using [LabelImg](https://github.com/tzutalin/labelImg) to convert them to the Pascal VOC format. Once you've generated labels for your images, convert them to the `TFRecord` format by running the `convert_to_tfrecord.py` script (run it once for training images and once for test images):

```
python convert_to_tfrecord.py --images_dir=path/to/train/images --labels_dir=path/to/train/labels --output_path=train.record
python convert_to_tfrecord.py --images_dir=path/to/test/images --labels_dir=path/to/test/labels --output_path=test.record
```

Next, download and unzip the latest MobileNet checkpoint (I used [this one](https://medium.com/r/?url=http%3A%2F%2Fdownload.tensorflow.org%2Fmodels%2Fmobilenet_v1_1.0_224_2017_06_14.tar.gz)). Create a project in the Google Cloud Console and enable Cloud Machine Learning Engine.

Create a **regional** Cloud Storage bucket in your project, and in a `data/` subdirectory in the bucket, upload the following files:
* The 3 files from the MobileNet checkpoint you downloaded (`.index`, `.meta`, and `.data`)
* Your `train.record` and `test.record` TFRecord files
* The `tswift_label_map.pbtxt` file updated with the name and ID of your label(s)
* The `ssd_mobilenet_v1_coco.config` file, replacing `YOUR_GCS_BUCKET` with the name of your Cloud Storage bucket. Make sure the filepaths in this config file are the same as the filenames in your GCS bucket

Then create empty `train/` and `eval/` subdirectories in the root of your GCS bucket

## Training and exporting a model on Cloud ML Engine

Run training with the following `gcloud` CLI command (from the `tensorflow/models/research` dir cloned locally:
```
# Run this script from tensorflow/models/research: 
gcloud ml-engine jobs submit training ${YOUR_TRAINING_JOB_NAME} \
    --job-dir=${YOUR_GCS_BUCKET}/train \
    --packages dist/object_detection-0.1.tar.gz,slim/dist/slim-0.1.tar.gz \
    --module-name object_detection.train \
    --region us-central1 \
    --config object_detection/samples/cloud/cloud.yml \
    --runtime-version=1.4
    -- \
    --train_dir=${YOUR_GCS_BUCKET}/train \
    --pipeline_config_path=${YOUR_GCS_BUCKET}/data/ssd_mobilenet_v1_coco.config
```

While training is running, you can also kick off an evaluation job:
```
# Run this script from tensorflow/models/research: 
gcloud ml-engine jobs submit training ${YOUR_EVAL_JOB_NAME} \
    --job-dir=${YOUR_GCS_BUCKET}/train \
    --packages dist/object_detection-0.1.tar.gz,slim/dist/slim-0.1.tar.gz \
    --module-name object_detection.eval \
    --region us-central1 \
    --scale-tier BASIC_GPU \
    --runtime-version=1.4
    -- \
    --checkpoint_dir=${YOUR_GCS_BUCKET}/train \
    --eval_dir=${YOUR_GCS_BUCKET}/eval \
    --pipeline_config_path=${YOUR_GCS_BUCKET}/data/ssd_mobilenet_v1_coco.config
```

When training finishes, go to the `train/` directory and open the `checkpoint` file. Find the number of the latest checkpoint, and download the 3 files associated with that checkpoint locally. From `tensorflow/models/research`, run this script to convert your model checkpoint to a ProtoBuf:

```
# Run this script from tensorflow/models/research: 
python object_detection/export_inference_graph.py \
    --input_type encoded_image_string_tensor \
    --pipeline_config_path ${LOCAL_PATH_TO_MOBILENET_CONFIG} \
    --trained_checkpoint_prefix model.ckpt-${CHECKPOINT_NUMBER} \
    --output_directory ${PATH_TO_YOUR_OUTPUT}.pb
```

Find the `saved_model.pb` file in your output directory (it should be in a `saved_model` subdirectory) and upload it to the `data/` dir in your GCS bucket.

## Deploying a model on Cloud ML Engine

First create a new model with gcloud:

`gcloud ml-engine models create YOUR_MODEL_NAME`

And deploy it:

`gcloud ml-engine versions create v1 --model=YOUR_MODEL_NAME --origin=gs://${YOUR_GCS_BUCKET}/data  --runtime-version=1.4`

Now you're ready to make predictions!

## Making predictions on the model via Swift & Cloud Functions

* Install the [Firebase CLI](https://firebase.google.com/docs/cli/) and initialize a project with Storage, Functions, and Firestore. 
* Copy the dependencies from `firebase/functions/package.json` and run `npm install` from the `functions/` directory
* Copy the code from `firebase/functions/index.js` to your functions directory. Update the name value in the `params` with the name of your Cloud project and ML Engine model. Then deploy the function by running: `firebase deploy --only functions`. 
* Once the function deploys, test it out: create an `images/` subdirectory in the Storage bucket in your Firebase console, and upload an image (ideally it contains whatever you're trying to detect). If you're detection model finds an object in the image with > 70% confidence (I chose 70%, you can change it in the functions code), you should see something like the following written to your Firestore database:

![Firestore screenshot](/screenshots/firestore-detection.png)

The `image_path` key corresponds to the path where your outlined image was written to your Storage bucket. Confirm the image was added to your storage bucket with a box drawn wherever the detected object was found. If `image_path` is empty, no object (with > 70% confidence) was found.
* After confirming your function is working correctly (you can debug it by checking the logs in your Functions console), it's time to wire up the iOS client (you could easily write a [web](https://firebase.google.com/docs/web/setup) or [Android](https://firebase.google.com/docs/android/setup) client in addition to this, but it's a Taylor Swift detector so...Swift).
* Set up an iOS project in your Firebase console by selecting "Add Firebase to your iOS app" on your project overview page:

![Overview screenshot](/screenshots/select-ios.png)

* Open the `swift-client` subdirectory in XCode
* Download the `GoogleService-Info.plist` file from your Firebase console and drag it into the root directory for your project (full iOS setup instructions for Firebase are [here](https://firebase.google.com/docs/ios/setup))
* Run the app in the simulator or on an iOS device: upload an image through the UI. If an object was detected, you should see an image with a detection box displayed in your UI once the prediction request completes


