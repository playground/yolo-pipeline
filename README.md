# Tensorflow pipeline build with NodeJS

This project aims to streamline the process of training a Tensorflow V2 deep neural network model from A to Z.  This project assumes you have already set up your system and environment with the Python >= V3.5

pre_process.js is script that provides the sub-processes that will help you through the entire process from labeling the dataset to generating the inference graph with a saved model that can be used in your nodejs application for inferencing or object detections.

* Start with your image dataset
* Resize images (depending on your use case, smaller images size speeds up training time)
* Use tool like labelImag, Maximo Visual Inspection & etc. to label and create bounnding boxes for each class type for each image
* Break the dataset into a training set and a testing set (9:1 ratio)
* Covert csv files from xml files of the data set for generating TFRecord
* Generate TRecord
* Train model
* Generate inference graph from trained model 

## Step 1
- Git clone git@github.com:playground/yolo-pipelline.git
- CD into yolo-pipeline and run ```npm install```
- Create a directory ```<my_dataset>``` for you image dataset anywhere on your machine

## Step 2
- In tfjs-pipelne directory, resize your images uniformly by runnning

  ```npm run pre_process --task=resize_image --image_dir=<my_dataset> --width=800 --height=600```

## Step 3
- Use one of the tools like lableImg, MVI(Maximo Visual Inspection) or any others to label and create bounding boxes for each of your images in your dataset
- The tool will generate a mapping xml file with the bounding box coordinate for each custom class you have created for your dataset
- Here is an example of what the xml output from labelImg will look like
```
<annotation>
	<folder>images</folder>
	<filename>hardhat1.jpg</filename>
	<path>/Users/jeff/git_repo/sandbox/wu/playbox/ml/TensorFlow/workspace/training_demo/images/hardhat1.jpg</path>
	<source>
		<database>Unknown</database>
	</source>
	<size>
		<width>800</width>
		<height>600</height>
		<depth>3</depth>
	</size>
	<segmented>0</segmented>
	<object>
		<name>hard-hat</name>
		<pose>Unspecified</pose>
		<truncated>0</truncated>
		<difficult>0</difficult>
		<bndbox>
			<xmin>145</xmin>
			<ymin>37</ymin>
			<xmax>453</xmax>
			<ymax>231</ymax>
		</bndbox>
	</object>
</annotation>
```

- Depending on which tool you use to label your dataset, the xml format will vary but the neccessary information are there for converting to cvs in the following steps
- Pre_process.js script currently supports both labelImg and MVI formats conversion
- Now is a good time to create a labelmap.pbtxt file which will be needed for training the model in a later step.  This file should contain the custom classes you have defined for labeling the dataset.  Here is an example of a lablemap.pbtxt file:
```
  item {
    name: "none_of_the_above"
    id: 0
    display_name: "background"
  }
  item {
    id: 1
    name: 'hard-hat'
    display_name: "hardhat"
  }
```

## Step 4 (optional)
- If you would like to partition your dataset into test and train model, run the following command

  ```npm run prec_process --task=partition_dataset --image_dir=<my_dataset_dir>```

## Step 5
- Convert xml to cvs files which are needed by generate_tfrecord.py to generate TFRecord

  ```npm run pre-process --image_dir=<my_dataset_dir> --task=xml_to_csv```     
  ```npm run pre-process --image_dir=<my_dataset_dir> --task=xml_to_csv --origin=maximo```     

## Step 6
- To generate the TFRecord that we can use to train the model, run the following command

  ```npm run pre_process --task=generate_tfrecords --image_dir=<my_dataset_dir>```

## Step 7
- To train model, run the following commmand

  ```npm run pre_process --task=train_model --pipeline_config_path=<my_dataset_dir>/pipeline.config --model_dir=<my_dataset_dir>/training```

## Step 9
- To generate inference graph from trained model, run the following command

  ```npm run pre_process --task=export_inference_graph --trained_checkpoint_dir=<my_dataset_dir>/training --pipeline_config_path=<my_dataset_dir>/pipeline.config --output_directory=<my_dataset_dir>/inference_graph```

## Build Docker Image

```docker build --ssh github=$HOME/.ssh/id_rsa -t tfjs-pipeline-ubuntu-2104 .```

## Train model in docker container
```docker run -it --rm --privileged -v <PATH_TO_DATASET> playbox21/tfjs-pipeline-ubuntu-1804:1.0.0```

## Or you can pull from docker hub
```docker pull playbox21/tfjs-pipeline-ubuntu-1804:1.0.0```

```docker pull playbox21/tfjs-pipeline-ubuntu-2104:1.0.0```
