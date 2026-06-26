import boto3
import logging
import json
from botocore.exceptions import ClientError
from app.core.setting import settings

logger = logging.getLogger("minio")

def get_minio_client():
    """
    Returns an S3/MinIO client using configured settings.
    """
    return boto3.client(
        "s3",
        endpoint_url=settings.MINIO_ENDPOINT_URL,
        aws_access_key_id=settings.MINIO_ACCESS_KEY,
        aws_secret_access_key=settings.MINIO_SECRET_KEY,
        config=boto3.session.Config(signature_version="s3v4"),
    )

def set_bucket_public_policy(client, bucket_name: str):
    """
    Sets a public read policy on the specified bucket.
    """
    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "PublicReadGetObject",
                "Effect": "Allow",
                "Principal": "*",
                "Action": ["s3:GetObject"],
                "Resource": [f"arn:aws:s3:::{bucket_name}/*"]
            }
        ]
    }
    try:
        client.put_bucket_policy(Bucket=bucket_name, Policy=json.dumps(policy))
        logger.info(f"Successfully set public read policy on MinIO bucket '{bucket_name}'.")
    except Exception as e:
        logger.error(f"Failed to set public policy on MinIO bucket '{bucket_name}': {e}")

def init_minio():
    """
    Creates the configured bucket if it does not already exist and ensures it has public read policy.
    """
    client = get_minio_client()
    bucket_name = settings.MINIO_BUCKET_NAME
    try:
        # Check if bucket exists
        client.head_bucket(Bucket=bucket_name)
        logger.info(f"MinIO bucket '{bucket_name}' already exists.")
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code")
        # 404 means bucket does not exist
        if error_code == "404":
            try:
                client.create_bucket(Bucket=bucket_name)
                logger.info(f"Successfully created MinIO bucket '{bucket_name}'.")
            except Exception as create_err:
                logger.error(f"Failed to create MinIO bucket '{bucket_name}': {create_err}")
                raise create_err
        else:
            logger.error(f"Error checking MinIO bucket '{bucket_name}': {e}")
            raise e
    
    # Ensure public read policy is set so browser previews work without Access Denied
    set_bucket_public_policy(client, bucket_name)

def upload_to_minio(file_bytes: bytes, object_key: str) -> str:
    """
    Uploads raw file bytes to the configured MinIO bucket with the correct ContentType.
    """
    client = get_minio_client()
    bucket_name = settings.MINIO_BUCKET_NAME
    
    # Detect ContentType based on extension to prevent auto-download in browser previews
    content_type = "application/octet-stream"
    ext = object_key.split(".")[-1].lower()
    if ext == "pdf":
        content_type = "application/pdf"
    elif ext == "png":
        content_type = "image/png"
    elif ext in ("jpg", "jpeg"):
        content_type = "image/jpeg"
    elif ext == "webp":
        content_type = "image/webp"

    try:
        client.put_object(
            Bucket=bucket_name,
            Key=object_key,
            Body=file_bytes,
            ContentType=content_type,
            ContentDisposition="inline",
        )
        logger.info(f"Successfully uploaded '{object_key}' to MinIO bucket '{bucket_name}' as {content_type}.")
        return object_key
    except Exception as e:
        logger.error(f"Failed to upload '{object_key}' to MinIO: {e}")
        raise e

def download_from_minio(object_key: str, local_path: str) -> None:
    """
    Downloads an object from the configured MinIO bucket to a local file path.
    """
    client = get_minio_client()
    bucket_name = settings.MINIO_BUCKET_NAME
    try:
        client.download_file(bucket_name, object_key, local_path)
        logger.info(f"Successfully downloaded '{object_key}' from MinIO to '{local_path}'.")
    except Exception as e:
        logger.error(f"Failed to download '{object_key}' from MinIO: {e}")
        raise e

def delete_from_minio(object_key: str) -> None:
    """
    Deletes an object from the configured MinIO bucket.
    """
    client = get_minio_client()
    bucket_name = settings.MINIO_BUCKET_NAME
    try:
        client.delete_object(Bucket=bucket_name, Key=object_key)
        logger.info(f"Successfully deleted '{object_key}' from MinIO bucket '{bucket_name}'.")
    except Exception as e:
        logger.error(f"Failed to delete '{object_key}' from MinIO: {e}")
        raise e
