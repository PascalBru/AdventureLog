<script lang="ts">
	import { addToast } from '$lib/toasts';
	import type { Checklist, Collection, User } from '$lib/types';
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();
	import { t } from 'svelte-i18n';

	import Launch from '~icons/mdi/launch';
	import TrashCan from '~icons/mdi/trash-can';
	import Calendar from '~icons/mdi/calendar';

	export let checklist: Checklist;
	export let user: User | null = null;
	export let collection: Collection | null = null;

	function editChecklist() {
		dispatch('edit', checklist);
	}

	async function deleteChecklist() {
		const res = await fetch(`/api/checklists/${checklist.id}`, {
			method: 'DELETE'
		});
		if (res.ok) {
			addToast('success', $t('checklist.checklist_deleted'));
			dispatch('delete', checklist.id);
		} else {
			addToast($t('checklist.checklist_delete_error'), 'error');
		}
	}
</script>

<div
	class="card w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-md xl:max-w-md bg-neutral text-neutral-content shadow-xl overflow-hidden"
>
	<div class="card-body">
		<div class="flex justify-between">
			<h2 class="text-2xl font-semibold -mt-2 break-words text-wrap">
				{checklist.name}
			</h2>
		</div>
		<div class="badge badge-primary">{$t('adventures.checklist')}</div>
		{#if checklist.items.length > 0}
			<p>
				{checklist.items.length}
				{checklist.items.length > 1 ? $t('checklist.items') : $t('checklist.item')}
			</p>
		{/if}
		{#if checklist.date && checklist.date !== ''}
			<div class="inline-flex items-center">
				<Calendar class="w-5 h-5 mr-1" />
				<p>{new Date(checklist.date).toLocaleDateString(undefined, { timeZone: 'UTC' })}</p>
			</div>
		{/if}
		<div class="card-actions justify-end">
			<button class="btn btn-neutral-200 mb-2" on:click={editChecklist}>
				<Launch class="w-6 h-6" />{$t('notes.open')}
			</button>
			{#if checklist.user_id == user?.uuid || (collection && user && collection.shared_with.includes(user.uuid))}
				<button
					id="delete_adventure"
					data-umami-event="Delete Checklist"
					class="btn btn-warning"
					on:click={deleteChecklist}><TrashCan class="w-6 h-6" /></button
				>
			{/if}
		</div>
	</div>
</div>
