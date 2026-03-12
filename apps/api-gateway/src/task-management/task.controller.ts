import { uploadFile } from "@shared/utils/minio.client";
/**
 * @fileoverview Task gateway controller.
 *
 * Exposes task-related HTTP endpoints.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { MongoIdDto, SearchQueryDto } from "@shared/dto";
import type { AuthUser } from "@shared/interfaces";
import { TaskStatus } from "apps/workforce-service/src/schemas/task.schema";
import { CreateTaskDto } from "apps/workforce-service/src/task-management/dto/create-task.dto";
import {
  ReplyOnDcrReviewDto,
  UpdateDcrSubmissionStatusDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
} from "apps/workforce-service/src/task-management/dto/update-task.dto";
import type { Multer } from "multer";
import { memoryStorage } from "multer";
import { ApiErrorResponses } from "../common/decorators/api-error-response.decorator";
import { ApiRequestDetails } from "../common/decorators/api-request.decorator";
import { ApiSuccessResponse } from "../common/decorators/api-success-response.decorator";
import { GetUser } from "../common/decorators/get-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { AccessGuard } from "../common/guards/access.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  TaskByIdForbiddenDto,
  TaskCreateForbiddenDto,
  TaskDCRReviewReplyForbiddenDto,
  TaskDCRSubmissionForbiddenDto,
  TaskDCRSubmissionStatusUpdateForbiddenDto,
  TaskDeleteForbiddenDto,
  TaskListForbiddenDto,
  TaskStatusUpdateForbiddenDto,
  TaskUpdateForbiddenDto,
} from "./dto/error/task-forbidden.dto";
import {
  TaskByIdInternalErrorDto,
  TaskCreateInternalErrorDto,
  TaskDCRSubmissionInternalErrorDto,
  TaskDCRSubmissionStatusInternalErrorDto,
  TaskDeleteInternalErrorDto,
  TaskListInternalErrorDto,
  TaskReplyOnDcrReviewInternalErrorDto,
  TaskStatusUpdateInternalErrorDto,
  TaskUpdateInternalErrorDto,
} from "./dto/error/task-internal-error.dto";
import {
  TaskByIdNotFoundDto,
  TaskDCRReviewOnReplyNotFoundDto,
  TaskDCRSubmissionNotFoundDto,
  TaskDCRSubmissionStatusUpdateNotFoundDto,
  TaskDeleteNotFoundDto,
  TaskStatusUpdateNotFoundDto,
  TaskUpdateNotFoundDto,
} from "./dto/error/task-not-found.dto";
import {
  TaskByIdUnauthorizedDto,
  TaskCreateUnauthorizedDto,
  TaskDCRSubmissionStatusUpdateUnauthorizedDto,
  TaskDCRSubmissionUnauthorizedDto,
  TaskDeleteUnauthorizedDto,
  TaskListUnauthorizedDto,
  TaskReplyOnDcrReviewUnauthorizedDto,
  TaskStatusUpdateUnauthorizedDto,
  TaskUpdateUnauthorizedDto,
} from "./dto/error/task-unauthorized.dto";
import {
  TaskByIdValidationDto,
  TaskCreateValidationDto,
  TaskDCRReviewOnReplyValidationDto,
  TaskDCRSubmissionStatusUpdateValidationDto,
  TaskDCRSubmissionValidationDto,
  TaskDeleteValidationDto,
  TaskListValidationDto,
  TaskStatusUpdateValidationDto,
  TaskUpdateValidationDto,
} from "./dto/error/task-validation.dto";
import {
  TaskByIdSuccessDto,
  TaskCreateSuccessDto,
  TaskDcrReviewReplySuccessDto,
  TaskDcrSubmissionStatusSuccessDto,
  TaskDcrSubmitSuccessDto,
  TaskDeleteSuccessDto,
  TaskListSuccessDto,
  TaskStatusUpdateFoundDto,
  TaskUpdateSuccessDto,
} from "./dto/success/project-success.dto";
import { TaskService } from "./task.service";

@ApiTags("Task Management")
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller("task")
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  /**
   * Create a new task.
   *
   * Message Pattern: { cmd: TASK_COMMANDS.CREATE_TASK }
   *
   * @param {CreateTaskDto} createTaskDto - The details of the task being created.
   * @returns {Promise<any>} The created task details.
   */
  @ApiOperation({
    summary: "Create a new task",
    description:
      "Creates a new task in the system. Requires authentication and appropriate permissions.",
  })
  @ApiBearerAuth("Authorization")
  @ApiHeader({
    name: "Authorization",
    description: "Bearer token",
    required: true,
  })
  @ApiSuccessResponse(TaskCreateSuccessDto, 201)
  @ApiErrorResponses({
    validation: TaskCreateValidationDto,
    unauthorized: TaskCreateUnauthorizedDto,
    forbidden: TaskCreateForbiddenDto,
    internal: TaskCreateInternalErrorDto,
  })
  @Roles("PROJECT MANAGER", "TEAM LEADER", "EMPLOYEE")
  @Post()
  async create(
    @GetUser() user: AuthUser,
    @Body() createTaskDto: CreateTaskDto,
  ) {
    return await this.taskService.create(user, createTaskDto);
  }

  /**
   * Get all tasks.
   *
   * Message Pattern: { cmd: TASK_COMMANDS.GET_TASKS }
   *
   * @param {AuthUser} user - The authenticated user requesting the tasks.
   * @param {SearchQueryDto} query - The search query parameters for filtering tasks.
   * @returns {Promise<any>} A list of all tasks matching the search criteria.
   */
  @ApiOperation({
    summary: "Get all tasks",
    description:
      "Retrieves a list of all tasks. Requires authentication and appropriate permissions.",
  })
  @ApiBearerAuth("Authorization")
  @ApiHeader({
    name: "Authorization",
    description: "Bearer token",
    required: true,
  })
  @ApiRequestDetails({
    queries: [
      {
        name: "pageNo",
        description: "The page number for pagination (1-based index)",
        required: true,
        type: Number,
      },
      {
        name: "pageSize",
        description: "The number of items per page for pagination",
        required: true,
        type: Number,
      },
      {
        name: "searchKey",
        description: "Search term to filter projects by name or order ID",
        required: false,
        type: String,
      },
      {
        name: "status",
        description: "Filter projects by status",
        required: false,
        type: String,
        enum: Object.values(TaskStatus),
      },
    ],
  })
  @ApiSuccessResponse(TaskListSuccessDto, 200)
  @ApiErrorResponses({
    unauthorized: TaskListUnauthorizedDto,
    validation: TaskListValidationDto,
    forbidden: TaskListForbiddenDto,
    internal: TaskListInternalErrorDto,
  })
  @Roles("PROJECT MANAGER", "TEAM LEADER", "EMPLOYEE")
  @Get()
  async findAll(
    @GetUser() user: AuthUser,
    @Query() query: SearchQueryDto & { status: TaskStatus },
  ) {
    return await this.taskService.findAll(user, query);
  }

  /**
   * Get a task by ID.
   *
   * Message Pattern: { cmd: TASK_COMMANDS.GET_TASK }
   *
   * @param {AuthUser} user - The authenticated user requesting the task.
   * @param {MongoIdDto["id"]} id - The ID of the task to retrieve.
   * @returns {Promise<any>} The details of the task with the specified ID.
   */
  @ApiOperation({
    summary: "Get a task by ID",
    description:
      "Retrieves a specific task by its ID. Requires authentication and appropriate permissions.",
  })
  @ApiBearerAuth("Authorization")
  @ApiHeader({
    name: "Authorization",
    description: "Bearer token",
    required: true,
  })
  @ApiRequestDetails({
    params: {
      name: "id",
      description: "The ID of the task to retrieve",
      required: true,
      type: String,
      example: "65f1b2c3d4e5f67890123456",
    },
    paramDto: MongoIdDto,
  })
  @ApiSuccessResponse(TaskByIdSuccessDto, 200)
  @ApiErrorResponses({
    notFound: TaskByIdNotFoundDto,
    validation: TaskByIdValidationDto,
    unauthorized: TaskByIdUnauthorizedDto,
    forbidden: TaskByIdForbiddenDto,
    internal: TaskByIdInternalErrorDto,
  })
  @Roles("PROJECT MANAGER", "TEAM LEADER", "EMPLOYEE")
  @Get(":id")
  async findOne(@GetUser() user: AuthUser, @Param() param: MongoIdDto) {
    return await this.taskService.findOne(user, param.id);
  }

  /**
   * Update a task by ID.
   *
   * Message Pattern: { cmd: TASK_COMMANDS.UPDATE_TASK }
   *
   * @param {AuthUser} user - The authenticated user updating the task.
   * @param {MongoIdDto["id"]} id - The ID of the task to update.
   * @param {UpdateTaskDto} updateTaskDto - The updated details of the task.
   * @returns {Promise<any>} The updated task details.
   */
  @ApiOperation({
    summary: "Update a task by ID",
    description:
      "Updates a specific task by its ID. Requires authentication and appropriate permissions.",
  })
  @ApiBearerAuth("Authorization")
  @ApiHeader({
    name: "Authorization",
    description: "Bearer token",
    required: true,
  })
  @ApiRequestDetails({
    params: {
      name: "id",
      description: "The ID of the task to update",
      required: true,
      type: String,
      example: "65f1b2c3d4e5f67890123456",
    },
    paramDto: MongoIdDto,
  })
  @ApiSuccessResponse(TaskUpdateSuccessDto, 200)
  @ApiErrorResponses({
    notFound: TaskUpdateNotFoundDto,
    validation: TaskUpdateValidationDto,
    unauthorized: TaskUpdateUnauthorizedDto,
    forbidden: TaskUpdateForbiddenDto,
    internal: TaskUpdateInternalErrorDto,
  })
  @Roles("PROJECT MANAGER", "TEAM LEADER", "EMPLOYEE")
  @Patch(":id")
  async update(
    @GetUser() user: AuthUser,
    @Param() param: MongoIdDto,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    return await this.taskService.update(user, param.id, updateTaskDto);
  }

  /**
   * Update a task's status by ID.
   *
   * Message Pattern: { cmd: TASK_COMMANDS.UPDATE_TASK_STATUS }
   *
   * @param {AuthUser} user - The authenticated user updating the task status.
   * @param {MongoIdDto["id"]} id - The ID of the task to update.
   * @param {UpdateTaskStatusDto} updateTaskStatusDto - The updated status of the task.
   * @returns {Promise<any>} The updated task details with the new status.
   */
  @ApiOperation({
    summary: "Update a task's status by ID",
    description:
      "Updates the status of a specific task by its ID. Requires authentication and appropriate permissions.",
  })
  @ApiBearerAuth("Authorization")
  @ApiHeader({
    name: "Authorization",
    description: "Bearer token",
    required: true,
  })
  @ApiRequestDetails({
    params: {
      name: "id",
      description: "The ID of the task to update the status for",
      required: true,
      type: String,
      example: "65f1b2c3d4e5f67890123456",
    },
    paramDto: MongoIdDto,
  })
  @ApiSuccessResponse(TaskStatusUpdateFoundDto, 200)
  @ApiErrorResponses({
    notFound: TaskStatusUpdateNotFoundDto,
    validation: TaskStatusUpdateValidationDto,
    unauthorized: TaskStatusUpdateUnauthorizedDto,
    forbidden: TaskStatusUpdateForbiddenDto,
    internal: TaskStatusUpdateInternalErrorDto,
  })
  @Roles("PROJECT MANAGER", "TEAM LEADER")
  @Patch(":id/status")
  async updateTaskStatus(
    @GetUser() user: AuthUser,
    @Param() param: MongoIdDto,
    @Body() updateTaskStatusDto: UpdateTaskStatusDto,
  ) {
    return await this.taskService.updateStatus(
      user,
      param.id,
      updateTaskStatusDto,
    );
  }

  /**
   * Delete a task by ID.
   *
   * Message Pattern: { cmd: TASK_COMMANDS.DELETE_TASK }
   *
   * @param {AuthUser} user - The authenticated user deleting the task.
   * @param {MongoIdDto["id"]} id - The ID of the task to delete.
   * @returns {Promise<any>} A message indicating the result of the delete operation.
   */
  @ApiOperation({
    summary: "Delete a task by ID",
    description:
      "Deletes a specific task by its ID. Requires authentication and appropriate permissions.",
  })
  @ApiBearerAuth("Authorization")
  @ApiHeader({
    name: "Authorization",
    description: "Bearer token",
    required: true,
  })
  @ApiRequestDetails({
    params: {
      name: "id",
      description: "The ID of the task to retrieve",
      required: true,
      type: String,
      example: "65f1b2c3d4e5f67890123456",
    },
    paramDto: MongoIdDto,
  })
  @ApiSuccessResponse(TaskDeleteSuccessDto, 200)
  @ApiErrorResponses({
    notFound: TaskDeleteNotFoundDto,
    validation: TaskDeleteValidationDto,
    unauthorized: TaskDeleteUnauthorizedDto,
    forbidden: TaskDeleteForbiddenDto,
    internal: TaskDeleteInternalErrorDto,
  })
  @Roles("PROJECT MANAGER", "TEAM LEADER", "EMPLOYEE")
  @Delete(":id")
  async delete(@GetUser() user: AuthUser, @Param() param: MongoIdDto) {
    return await this.taskService.delete(user, param.id);
  }

  /**
   * Submit a DCR (Design Change Request) for a specific task.
   *
   * Message Pattern: { cmd: TASK_COMMANDS.DCR_SUBMIT }
   *
   * @param {AuthUser} user - The authenticated user submitting the DCR.
   * @param {MongoIdDto["id"]} id - The ID of the task for which the DCR is being submitted.
   * @param {Multer.File[]} dcrFiles - The files being submitted as part of the DCR.
   * @returns {Promise<any>} A message indicating the result of the DCR submission.
   */
  @ApiOperation({
    summary: "Submit a DCR for a task",
    description:
      "Submits a DCR (Design Completion Report) for a specific task. Requires authentication and appropriate permissions. Accepts multipart/form-data for DCR file uploads.",
  })
  @ApiBearerAuth("Authorization")
  @ApiHeader({
    name: "Authorization",
    description: "Bearer token",
    required: true,
  })
  @ApiRequestDetails({
    params: {
      name: "id",
      description: "The ID of the task for which the DCR is being submitted",
      required: true,
      type: String,
      example: "65f1b2c3d4e5f67890123456",
    },
    paramDto: MongoIdDto,
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        dcrFiles: {
          type: "array",
          items: {
            type: "string",
            format: "binary",
          },
          description: "The files being submitted as part of the DCR",
        },
      },
      required: ["dcrFiles"],
    },
  })
  @ApiSuccessResponse(TaskDcrSubmitSuccessDto, 200)
  @ApiErrorResponses({
    validation: TaskDCRSubmissionValidationDto,
    notFound: TaskDCRSubmissionNotFoundDto,
    unauthorized: TaskDCRSubmissionUnauthorizedDto,
    forbidden: TaskDCRSubmissionForbiddenDto,
    internal: TaskDCRSubmissionInternalErrorDto,
  })
  @Roles("PROJECT MANAGER", "TEAM LEADER", "EMPLOYEE")
  @UseInterceptors(
    FilesInterceptor("dcrFiles", 10, {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
      fileFilter: (req, file, callback) => {
        const allowedMimeTypes = [
          "image/jpeg",
          "image/png",
          "image/jpg",
          "image/webp",
          "text/plain",
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              "Only images, text, pdf, word and powerpoint files are allowed",
            ),
            false,
          );
        }
      },
    }),
  )
  @Post(":id/dcr-submit")
  async submitDcr(
    @GetUser() user: AuthUser,
    @Param() param: MongoIdDto,
    @UploadedFiles() dcrFiles: Multer.File[],
  ) {
    const logger = new Logger(TaskController.name);

    if (!dcrFiles || dcrFiles.length === 0) {
      throw new BadRequestException("At least one DCR file is required");
    }

    let uploadedFileLinks: string[];

    try {
      uploadedFileLinks = await Promise.all(
        dcrFiles.map((file) =>
          uploadFile(file.buffer, file.originalname, file.mimetype),
        ),
      );
    } catch (err) {
      logger.error("DCR file upload failed", err);
      throw new InternalServerErrorException(
        "Failed to upload DCR files. Check storage configuration.",
      );
    }

    return await this.taskService.submitDcr(user, param.id, uploadedFileLinks);
  }

  /**
   * Updates the DCR submission status of a task
   *
   * Message Pattern: { cmd: TASK_COMMANDS.UPDATE_DCR_SUBMISSION_STATUS }
   *
   * @param {AuthUser} user - The authenticated user updating the DCR submission status.
   * @param {MongoIdDto["id"]} id - The ID of the task for which the DCR submission status is being updated.
   * @param {UpdateDcrSubmissionStatusDto} updateDcrSubmissionStatusDto - The new DCR submission status.
   * @returns {Promise<any>} A message indicating the result of the DCR submission status update.
   */
  @ApiOperation({
    summary: "Update the DCR submission status of a task",
    description:
      "Updates the DCR submission status of a specific task by its ID. Requires authentication and appropriate permissions.",
  })
  @ApiBearerAuth("Authorization")
  @ApiHeader({
    name: "Authorization",
    description: "Bearer token",
    required: true,
  })
  @ApiRequestDetails({
    params: {
      name: "id",
      description:
        "The ID of the task for which the DCR submission status is being updated",
      required: true,
      type: String,
      example: "65f1b2c3d4e5f67890123456",
    },
    paramDto: MongoIdDto,
  })
  @ApiBody({ type: UpdateDcrSubmissionStatusDto })
  @ApiSuccessResponse(TaskDcrSubmissionStatusSuccessDto, 200)
  @ApiErrorResponses({
    notFound: TaskDCRSubmissionStatusUpdateNotFoundDto,
    validation: TaskDCRSubmissionStatusUpdateValidationDto,
    unauthorized: TaskDCRSubmissionStatusUpdateUnauthorizedDto,
    forbidden: TaskDCRSubmissionStatusUpdateForbiddenDto,
    internal: TaskDCRSubmissionStatusInternalErrorDto,
  })
  @Roles("PROJECT MANAGER", "TEAM LEADER")
  @Patch(":id/dcr-submission-status")
  async updateDcrSubmissionStatus(
    @GetUser() user: AuthUser,
    @Param() param: MongoIdDto,
    @Body() updateDcrSubmissionStatusDto: UpdateDcrSubmissionStatusDto,
  ) {
    return await this.taskService.updateDcrStatus(
      user,
      param.id,
      updateDcrSubmissionStatusDto,
    );
  }

  /**
   * Reply to a DCR review comment for a specific task by its ID.
   *
   * Message Pattern: { cmd: TASK_COMMANDS.REPLY_ON_DCR_REVIEW }
   *
   * @param {AuthUser} user - The authenticated user replying to the DCR review.
   * @param {MongoIdDto["id"]} id - The ID of the task for which the DCR review reply is being made.
   * @param {ReplyOnDcrReviewDto["comment"]} comment - The comment for the DCR review reply.
   * @returns {Promise<any>} The updated task details with the new review reply.
   */
  @ApiOperation({
    summary: "Reply on a DCR review for a task",
    description:
      "Replies to a DCR review for a specific task by its ID. Requires authentication and appropriate permissions.",
  })
  @ApiBearerAuth("Authorization")
  @ApiHeader({
    name: "Authorization",
    description: "Bearer token",
    required: true,
  })
  @ApiRequestDetails({
    params: {
      name: "id",
      description:
        "The ID of the task for which the DCR review reply is being made",
      required: true,
      type: String,
      example: "65f1b2c3d4e5f67890123456",
    },
    paramDto: MongoIdDto,
  })
  @ApiSuccessResponse(TaskDcrReviewReplySuccessDto, 200)
  @ApiErrorResponses({
    notFound: TaskDCRReviewOnReplyNotFoundDto,
    validation: TaskDCRReviewOnReplyValidationDto,
    unauthorized: TaskReplyOnDcrReviewUnauthorizedDto,
    forbidden: TaskDCRReviewReplyForbiddenDto,
    internal: TaskReplyOnDcrReviewInternalErrorDto,
  })
  @Post(":id/reply-on-dcr-review")
  async replyOnDcrReview(
    @GetUser() user: AuthUser,
    @Param() param: MongoIdDto,
    @Body() body: ReplyOnDcrReviewDto,
  ) {
    return await this.taskService.replyOnDcrReview(
      user,
      param.id,
      body.comment,
    );
  }
}
