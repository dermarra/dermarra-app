import cloudinary
import cloudinary.uploader
from flask import current_app


def _configure():
    cloudinary.config(
        cloud_name=current_app.config["CLOUDINARY_CLOUD_NAME"],
        api_key=current_app.config["CLOUDINARY_API_KEY"],
        api_secret=current_app.config["CLOUDINARY_API_SECRET"],
        secure=True,
    )


def upload_image(file_storage, folder="derma-skincare/products"):
    _configure()
    result = cloudinary.uploader.upload(file_storage, folder=folder)
    return {
        "public_id": result["public_id"],
        "secure_url": result["secure_url"],
        "width": result.get("width"),
        "height": result.get("height"),
    }


def delete_image(public_id):
    _configure()
    return cloudinary.uploader.destroy(public_id)


def build_url(public_id, width=None, height=None):
    _configure()
    transformation = {"quality": "auto", "fetch_format": "auto"}
    if width:
        transformation["width"] = width
    if height:
        transformation["height"] = height
    return cloudinary.CloudinaryImage(public_id).build_url(**transformation)
