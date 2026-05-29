package storage

import (
	"context"
	"io"
	"log"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	appconfig "github.com/fittrack/backend/internal/config"
)

type S3Client struct {
	client  *s3.Client
	presign *s3.PresignClient
	bucket  string
	cfg     *appconfig.Config
}

func NewS3Client(cfg *appconfig.Config) *S3Client {
	awsCfg, err := awsconfig.LoadDefaultConfig(context.Background(),
		awsconfig.WithRegion(cfg.S3Region),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			cfg.S3AccessKey, cfg.S3SecretKey, "",
		)),
	)
	if err != nil {
		log.Fatalf("unable to load S3 config: %v", err)
	}

	s3Client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = true
		o.BaseEndpoint = aws.String(cfg.S3Endpoint)
	})

	// Ensure bucket exists
	ensureBucket(context.Background(), s3Client, cfg.S3Bucket)

	return &S3Client{
		client:  s3Client,
		presign: s3.NewPresignClient(s3Client),
		bucket:  cfg.S3Bucket,
		cfg:     cfg,
	}
}

func ensureBucket(ctx context.Context, client *s3.Client, bucket string) {
	_, err := client.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: aws.String(bucket)})
	if err == nil {
		return
	}
	if _, err := client.CreateBucket(ctx, &s3.CreateBucketInput{
		Bucket: aws.String(bucket),
	}); err != nil {
		log.Printf("warn: could not create S3 bucket %q: %v", bucket, err)
	} else {
		log.Printf("created S3 bucket %q", bucket)
	}
}

func (c *S3Client) Upload(ctx context.Context, key string, body io.Reader, size int64) error {
	_, err := c.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(c.bucket),
		Key:           aws.String(key),
		Body:          body,
		ContentLength: aws.Int64(size),
	})
	return err
}

func (c *S3Client) PresignGet(ctx context.Context, key string) (string, error) {
	result, err := c.presign.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(c.cfg.S3PresignTTL))
	if err != nil {
		return "", err
	}
	return result.URL, nil
}
