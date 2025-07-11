import { signal, For, If, $, t, watch, onDispose, derivedExtract, Render, useEffect } from 'refui'
import { Parse } from 'refui/extras/parse.js'
import { addTargetBlankToLinks } from '../utils/dom.js'
import { formatTime } from '../utils/time.js'

const CommentFallback = () => (R) => (
	<div class="comment-item comment-placeholder">
		<div class="comment-meta">
			<span class="placeholder-text"></span>
		</div>
		<div class="comment-text">
			<span class="placeholder-text"></span>
			<span class="placeholder-text"></span>
		</div>
	</div>
)

const ErrorFallback =
	({ error }) =>
	(R) => <div class="comment-error">Error: {error.message}</div>

const CommentItem = async ({ commentId, abort, storyData, depth }) => {
	const MAX_DEPTH = 3
	try {
		const response = await fetch(`https://hacker-news.firebaseio.com/v0/item/${commentId}.json`, { signal: abort })
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`)
		}
		const comment = await response.json()

		if (!comment) {
			return null
		}

		if (comment.dead) {
			return (R) => <div class="comment-item deleted-comment">[moderated]</div>
		}

		if (comment.deleted) {
			return (R) => <div class="comment-item deleted-comment">[deleted]</div>
		}

		const userUrl = `https://news.ycombinator.com/user?id=${comment.by}`
		const storyUrl = `https://news.ycombinator.com/item?id=${storyData.value.id}`

		const commentsPerPage = 5
		const commentsToShow = signal(depth >= MAX_DEPTH ? 0 : commentsPerPage)
		const childComments = $(() => comment.kids?.slice(0, commentsToShow.value) || [])

		if (depth >= MAX_DEPTH) {
			depth = 0
		}

		return (R) => (
			<div class="comment-item">
				<div class="comment-meta">
					by{' '}
					<a href={userUrl} target="_blank">
						{comment.by}
					</a>{' '}
					| {formatTime(comment.time)}
				</div>
				<div class="comment-text">
					<Parse text={comment.text} parser={addTargetBlankToLinks} />
				</div>
				<If condition={$(() => comment.kids && comment.kids.length > 0)}>
					{() => (
						<div class="comment-children">
							<If condition={$(() => depth < MAX_DEPTH || commentsToShow.value > 0)}>
								{() => (
									<For entries={childComments}>
										{({ item: kidId }) => (
											<CommentItem
												commentId={kidId}
												abort={abort}
												fallback={CommentFallback}
												catch={ErrorFallback}
												storyData={storyData}
												depth={depth + 1}
											/>
										)}
									</For>
								)}
							</If>
							<If condition={$(() => commentsToShow.value < comment.kids.length)}>
								{() => (
									<button class="load-more-btn" on:click={() => (commentsToShow.value += commentsPerPage)}>
										Load More ({$(() => comment.kids.length - commentsToShow.value)})
									</button>
								)}
							</If>
						</div>
					)}
				</If>
			</div>
		)
	} catch (error) {
		if (error.name === 'AbortError') {
			console.log('Fetch aborted for CommentItem:', commentId)
			return null // Return null or a placeholder if aborted
		} else {
			throw error // Re-throw other errors
		}
	}
}

const Comments = ({ storyData }) => {
	const commentsPerPage = 5
	const commentsToShow = signal(commentsPerPage)
	const isLoadingComments = signal(false)
	const { title, id, by, score, descendants, url, kids, text, time } = derivedExtract(
		storyData,
		'title',
		'id',
		'by',
		'score',
		'descendants',
		'url',
		'kids',
		'text',
		'time'
	)

	const comments = $(() => kids.value?.slice(0, commentsToShow.value) || [])

	const commentsUrl = t`https://news.ycombinator.com/item?id=${id}`
	const userUrl = t`https://news.ycombinator.com/user?id=${by}`

	let abortController = null

	useEffect(() => {
		storyData.touch()
		abortController = new AbortController()
		return () => {
			console.log('Comments unmounted or refreshed, aborting all pending requests.')
			abortController?.abort()
		}
	})

	return (R) => (
		<div class="comments-container">
			<div class="comments-header">
				<h3>
					<a href={url} target="_blank">
						{title}
					</a>
				</h3>
				<div class="story-meta">
					{score} points by{' '}
					<a href={userUrl} target="_blank">
						{by}
					</a>
					{' | '}
					<a href={commentsUrl} target="_blank">
						{descendants} comments
					</a>
					{' | '}
					<span class="time">{$(() => formatTime(time.value))}</span>
				</div>
				<If condition={text}>
					{() => (
						<div class="story-text">
							<Parse text={text} parser={addTargetBlankToLinks} />
						</div>
					)}
				</If>
			</div>
			<If condition={isLoadingComments}>
				{() => <div class="loading">Loading comments...</div>}
				{() => (
					<>
						<If condition={$(() => comments.value.length > 0)}>
							{() => (
								<For entries={comments}>
									{({ item: commentId }) => (
										<CommentItem
											commentId={commentId}
											fallback={CommentFallback}
											catch={ErrorFallback}
											storyData={storyData}
											abort={abortController.signal}
											depth={0}
										/>
									)}
								</For>
							)}
							{() => <div class="no-comments">No comments yet.</div>}
						</If>
						<If condition={$(() => commentsToShow.value < kids.value?.length)}>
							{() => (
								<button class="load-more-btn" on:click={() => (commentsToShow.value += commentsPerPage)}>
									Load More ({$(() => kids.value?.length - commentsToShow.value)})
								</button>
							)}
						</If>
					</>
				)}
			</If>
		</div>
	)
}

export default Comments
